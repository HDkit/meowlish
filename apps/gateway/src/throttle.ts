import { type ExecutionContext } from '@nestjs/common';
import { type ThrottlerModuleOptions } from '@nestjs/throttler';
import { type Request } from 'express';

const MINUTE = 60_000;

/** Stricter limit (10/min/IP) for login, register, refresh and password routes. */
export const strictThrottle = { default: { limit: 10, ttl: MINUTE } };

/** Health probes (`/health/*`, outside the `/api` prefix) must never be throttled. */
export const isHealthRoute = (context: ExecutionContext): boolean => {
	const req = context.switchToHttp().getRequest<Partial<Request>>();
	return (req.path ?? req.url ?? '').startsWith('/health/');
};

/** Default: 100 requests per minute per IP. */
export const throttlerOptions: ThrottlerModuleOptions = {
	throttlers: [{ ttl: MINUTE, limit: 100 }],
	skipIf: isHealthRoute,
	errorMessage: 'Rate limit reached',
};
