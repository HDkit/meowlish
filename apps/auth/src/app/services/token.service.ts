import { IEnvVars } from '../../configs/config';
import { Tokens } from '../../types/tokens.type';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenType } from '@server/typing';
import { Claims } from '@server/utils';
import Redis from 'ioredis';
import { z } from 'zod/v4';

/**
 * A refresh token presented again this soon after it was rotated gets the current member of its
 * family back instead of revoking it: several tabs share the cookie and may refresh at once.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** The refresh token being exchanged: its `jti`, and `fam` (absent before rotation existed). */
export interface PresentedRefreshToken {
	jti: string;
	family?: string;
}

/** What `auth:refresh:used:<jti>` remembers about a refresh token that was exchanged. */
const usedRecordSchema = z.object({
	family: z.string(),
	/** jti of the token issued in its place. */
	successor: z.string(),
	usedAtMs: z.number(),
});
type UsedRecord = z.infer<typeof usedRecordSchema>;

const parseUsedRecord = (raw: string | null): UsedRecord | undefined => {
	if (!raw) return undefined;
	try {
		const parsed = usedRecordSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
};

@Injectable()
export class TokenService {
	private readonly redis: Redis;

	constructor(
		@Inject('JWT_ACCESS_TOKEN') private readonly AccessTokenService: JwtService,
		@Inject('JWT_REFRESH_TOKEN') private readonly RefreshTokenService: JwtService,
		private readonly redisService: RedisService,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		this.redis = this.redisService.getOrThrow();
	}

	/** A new session: the refresh token (if any) starts a new rotation family. */
	async generateTokens(claims: Claims, genRefresh = false): Promise<Tokens> {
		return this.issueTokens(
			claims,
			genRefresh ? { jti: crypto.randomUUID(), family: crypto.randomUUID() } : undefined,
		);
	}

	/**
	 * Exchanges a refresh token for a new pair (rotation with reuse detection). Each refresh token
	 * can be exchanged once: `SET auth:refresh:used:<jti> NX` records the exchange and the jti of
	 * its successor. Presenting it again within REFRESH_REUSE_GRACE_MS returns the successor
	 * (re-signed, same jti and family) for concurrent tabs; later, it is treated as stolen and its
	 * whole family is revoked, so neither the thief nor the victim can refresh any more.
	 * A token from before rotation (no `fam`) starts a new family on its first exchange.
	 */
	async rotateTokens(claims: Claims, presented: PresentedRefreshToken): Promise<Tokens> {
		const family = presented.family ?? crypto.randomUUID();
		await this.assertFamilyActive(family);
		const successor = crypto.randomUUID();
		const record: UsedRecord = { family: family, successor: successor, usedAtMs: Date.now() };
		const first = await this.redis.set(
			this.usedKey(presented.jti),
			JSON.stringify(record),
			'EX',
			this.refreshTtlSeconds,
			'NX',
		);
		if (first === 'OK') return this.issueTokens(claims, { jti: successor, family: family });

		const prior = parseUsedRecord(await this.redis.get(this.usedKey(presented.jti)));
		// A pre-rotation token has no `fam`: its family is the one its first exchange started.
		const priorFamily = prior?.family ?? family;
		if (prior && Date.now() - prior.usedAtMs <= REFRESH_REUSE_GRACE_MS) {
			await this.assertFamilyActive(priorFamily);
			return this.issueTokens(claims, { jti: prior.successor, family: priorFamily });
		}
		await this.revokeFamily(priorFamily);
		throw new UnauthorizedException('Refresh token reused');
	}

	private async issueTokens(claims: Claims, refresh?: PresentedRefreshToken): Promise<Tokens> {
		const iatMs = await this.issueTimeMs(claims.sub);
		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(claims, iatMs),
			refresh ? this.generateRefreshToken(claims, iatMs, refresh) : undefined,
		]);

		return {
			accessToken: accessToken,
			...(refreshToken !== undefined && { refreshToken: refreshToken }),
		};
	}

	private get refreshTtlSeconds(): number {
		return this.configService.getOrThrow('jwt', { infer: true }).refreshTokenExpiration;
	}

	private usedKey(jti: string): string {
		return `auth:refresh:used:${jti}`;
	}

	private familyRevokedKey(family: string): string {
		return `auth:refresh:family:${family}:revoked`;
	}

	/** Every member of the family was issued at most one refresh lifetime ago, so this outlives them. */
	private async revokeFamily(family: string): Promise<void> {
		await this.redis.setex(this.familyRevokedKey(family), this.refreshTtlSeconds, Date.now());
	}

	private async assertFamilyActive(family: string): Promise<void> {
		if (await this.redis.exists(this.familyRevokedKey(family))) {
			throw new UnauthorizedException('Token has been revoked');
		}
	}

	/**
	 * `iatMs` is a millisecond-precision issue time. JWT `iat` is whole seconds, which cannot
	 * tell "issued just before a revoke" from "issued just after it" within the same second.
	 * A token issued after a revoke was written must outlive it even in the same millisecond
	 * (e.g. the new session the gateway issues right after a password change), so it is dated
	 * at least 1 ms after the stored revocation.
	 */
	private async issueTimeMs(userId: string): Promise<number> {
		const now = Date.now();
		const revokedAtMs = await this.revokedAtMs(userId);
		return revokedAtMs === undefined ? now : Math.max(now, revokedAtMs + 1);
	}

	private async generateAccessToken(claims: Claims, iatMs: number): Promise<string> {
		return await this.AccessTokenService.signAsync({
			...claims,
			typ: TokenType.Access,
			jti: crypto.randomUUID(),
			iatMs: iatMs,
		});
	}

	private async generateRefreshToken(
		claims: Claims,
		iatMs: number,
		refresh: PresentedRefreshToken,
	): Promise<string> {
		return await this.RefreshTokenService.signAsync({
			sub: claims.sub,
			typ: TokenType.Refresh,
			jti: refresh.jti,
			fam: refresh.family,
			iatMs: iatMs,
		});
	}

	private key(userId: string): string {
		return `jwt:blacklist:user:${userId}`;
	}

	async revokeUser(userId: string): Promise<void> {
		await this.redis.setex(this.key(userId), this.refreshTtlSeconds, Date.now());
	}

	/**
	 * revokedAt is stored in epoch milliseconds. Every token issued at or before it is revoked.
	 * Tokens carry `iatMs` (ms precision), so a login right after a revoke stays valid even within
	 * the same second. Legacy tokens without `iatMs` fall back to `iat * 1000` (fails closed).
	 */
	async isTokenRevoked(userId: string, tokenIat: number, tokenIatMs?: number): Promise<boolean> {
		const revokedAtMs = await this.revokedAtMs(userId);
		if (revokedAtMs === undefined) return false;
		return (tokenIatMs ?? tokenIat * 1000) <= revokedAtMs;
	}

	private async revokedAtMs(userId: string): Promise<number | undefined> {
		const revokedAt = await this.redis.get(this.key(userId));
		if (!revokedAt) return undefined;
		// Revocations written before the ms switch hold epoch seconds (~1.7e9); values below 1e11
		// can only be seconds, so normalise them to ms.
		const revokedAtMs = Number(revokedAt);
		return revokedAtMs < 1e11 ? revokedAtMs * 1000 : revokedAtMs;
	}
}
