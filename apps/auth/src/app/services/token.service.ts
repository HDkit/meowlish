import { IEnvVars } from '../../configs/config';
import { Tokens } from '../../types/tokens.type';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
		// Only generate refresh token if genRefresh is true
		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(claims),
			genRefresh ? this.generateRefreshToken(claims) : undefined,
		]);

		return {
			accessToken: accessToken,
			...(genRefresh && { refreshToken: refreshToken }),
		};
	}

	// `iatMs` is a millisecond-precision issue time. JWT `iat` is whole seconds, which cannot
	// tell "issued just before a revoke" from "issued just after it" within the same second.
	private async generateAccessToken(claims: Claims): Promise<string> {
		return await this.AccessTokenService.signAsync({
			...claims,
			jti: crypto.randomUUID(),
			iatMs: Date.now(),
		});
	}

	private async generateRefreshToken(claims: Claims): Promise<string> {
		const token = await this.RefreshTokenService.signAsync({
			sub: claims.sub,
			jti: crypto.randomUUID(),
			iatMs: Date.now(),
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
		const revokedAt = await this.redis.get(this.key(userId));
		if (!revokedAt) return false;
		// Revocations written before the ms switch hold epoch seconds (~1.7e9); values below 1e11
		// can only be seconds, so normalise them to ms.
		let revokedAtMs = Number(revokedAt);
		if (revokedAtMs < 1e11) revokedAtMs *= 1000;
		return (tokenIatMs ?? tokenIat * 1000) <= revokedAtMs;
	}
}
