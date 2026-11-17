import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const mqSchema = z.object({
	user: z.string(),
	password: z.string(),
	host: z.string(),
	port: z.coerce.number(),
});

const scorerSchema = z
	.object({
		minDelayMs: z.coerce.number().int().min(0).default(60_000),
		maxDelayMs: z.coerce.number().int().min(0).default(180_000),
	})
	.refine(v => v.minDelayMs <= v.maxDelayMs, {
		message: 'MOCK_SCORER_MIN_DELAY_MS must be <= MOCK_SCORER_MAX_DELAY_MS',
		path: ['minDelayMs'],
	});

/** Health HTTP listener on HOST:HEALTH_PORT. */
const serverSchema = z.object({
	host: z.string().default('127.0.0.1'),
	healthPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(9110)),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	server: serverSchema,
	messageQueue: mqSchema,
	scorer: scorerSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

// Unset or empty delay vars fall back to the schema defaults.
const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
	server: {
		host: process.env.HOST,
		healthPort: process.env.HEALTH_PORT,
	},
	messageQueue: {
		host: process.env.RMQ_HOST,
		port: process.env.RMQ_PORT,
		user: process.env.RMQ_USER,
		password: process.env.RMQ_PASS,
	},
	scorer: {
		minDelayMs: process.env.MOCK_SCORER_MIN_DELAY_MS || undefined,
		maxDelayMs: process.env.MOCK_SCORER_MAX_DELAY_MS || undefined,
	},
});

export const config = (): IEnvVars => envFileSchema.parse(loadEnv());
