import { IEnvVars } from './configs/config';
import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AppLoggerService, LoggerModule } from '@server/logger';
import Redis from 'ioredis';

/**
 * One hit, atomically: `KEYS[1]` counts the hits of the current window (expires with it), `KEYS[2]`
 * marks a block. While blocked, hits are not counted. Going over the limit starts a block of
 * `blockDuration` and resets the window, so counting starts afresh once the block ends.
 * Returns `[totalHits, msToWindowEnd, blocked (0/1), msToBlockEnd]`.
 */
const INCREMENT_SCRIPT = `
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
local blockLeft = redis.call('PTTL', KEYS[2])
if blockLeft > 0 then
	return { limit + 1, blockLeft, 1, blockLeft }
end
local hits = redis.call('INCR', KEYS[1])
local left = redis.call('PTTL', KEYS[1])
if left < 0 then
	redis.call('PEXPIRE', KEYS[1], ttl)
	left = ttl
end
if hits > limit then
	redis.call('SET', KEYS[2], '1', 'PX', block)
	redis.call('DEL', KEYS[1])
	return { hits, block, 1, block }
end
return { hits, left, 0, 0 }
`;

const KEY_PREFIX = 'throttle:';

type ScriptResult = [number, number, number, number];

/** `ThrottlerStorageRecord`, which `@nestjs/throttler` doesn't export. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Rate-limit counters in Redis, so every gateway replica shares them and they survive restarts.
 * Fails open to the in-memory counters while Redis is unreachable (limits then apply per replica,
 * as before), so a Redis outage never takes the API down. Uses its own connection with no
 * offline queue, so a dead Redis is noticed at once instead of making every request wait.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
	private readonly redis: Redis;
	private readonly fallback = new ThrottlerStorageService();
	private failing = false;

	constructor(
		configService: ConfigService<IEnvVars>,
		private readonly logger: AppLoggerService,
	) {
		const { host, port } = configService.getOrThrow('redis', { infer: true });
		this.redis = new Redis({
			host: host,
			port: port,
			enableOfflineQueue: false,
			maxRetriesPerRequest: 1,
			connectTimeout: 2_000,
			commandTimeout: 500,
		});
		// reconnects on its own; without a listener ioredis reports every failed attempt as unhandled
		this.redis.on('error', () => undefined);
	}

	async increment(
		key: string,
		ttl: number,
		limit: number,
		blockDuration: number,
		throttlerName: string,
	): Promise<ThrottlerStorageRecord> {
		try {
			const [totalHits, toExpire, blocked, toBlockExpire] = (await this.redis.eval(
				INCREMENT_SCRIPT,
				2,
				`${KEY_PREFIX}${key}:hits`,
				`${KEY_PREFIX}${key}:block`,
				ttl,
				limit,
				blockDuration,
			)) as ScriptResult;
			if (this.failing) {
				this.failing = false;
				this.logger.log('Rate limiting is back on Redis');
			}
			return {
				totalHits: totalHits,
				timeToExpire: Math.ceil(toExpire / 1000),
				isBlocked: blocked === 1,
				timeToBlockExpire: Math.ceil(toBlockExpire / 1000),
			};
		} catch (error) {
			if (!this.failing) {
				this.failing = true;
				this.logger.warn(
					`Redis unavailable for rate limiting, counting in memory: ${(error as Error).message}`,
				);
			}
			return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
		}
	}

	onModuleDestroy(): void {
		this.fallback.onApplicationShutdown();
		this.redis.disconnect();
	}
}

@Module({
	imports: [LoggerModule.forRoot({ appName: 'GatewayModule' })],
	providers: [RedisThrottlerStorage],
	exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
