import { IEnvVars } from '../../configs/config';
import { Tokens } from '../../types/tokens.type';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenType } from '@server/typing';
import { Claims } from '@server/utils';
import Redis from 'ioredis';

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

	async generateTokens(claims: Claims, genRefresh = false): Promise<Tokens> {
		const iatMs = await this.issueTimeMs(claims.sub);
		// Only generate refresh token if genRefresh is true
		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(claims, iatMs),
			genRefresh ? this.generateRefreshToken(claims, iatMs) : undefined,
		]);

		return {
			accessToken: accessToken,
			...(genRefresh && { refreshToken: refreshToken }),
		};
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

	private async generateRefreshToken(claims: Claims, iatMs: number): Promise<string> {
		const token = await this.RefreshTokenService.signAsync({
			sub: claims.sub,
			typ: TokenType.Refresh,
			jti: crypto.randomUUID(),
			iatMs: iatMs,
		});
		return token;
	}

	private key(userId: string): string {
		return `jwt:blacklist:user:${userId}`;
	}

	async revokeUser(userId: string): Promise<void> {
		await this.redis.setex(
			this.key(userId),
			this.configService.getOrThrow('jwt', { infer: true }).refreshTokenExpiration,
			Date.now(),
		);
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
