import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const dbVarsSchema = z.object({
	host: z.string(),
	port: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().default(5432)),
	username: z.string(),
	password: z.string(),
	dbName: z.string(),
});

const mqSchema = z.object({
	user: z.string(),
	password: z.string(),
	host: z.string(),
	port: z.coerce.number(),
});

/** Listeners: gRPC on HOST:PORT, health HTTP on HOST:HEALTH_PORT. */
const serverSchema = z.object({
	host: z.string().default('127.0.0.1'),
	port: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(50058)),
	healthPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(9108)),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	server: serverSchema,
	database: dbVarsSchema,
	messageQueue: mqSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
	server: {
		host: process.env.HOST,
		port: process.env.PORT,
		healthPort: process.env.HEALTH_PORT,
	},
	database: {
		host: process.env.POSTGRES_HOST,
		port: process.env.POSTGRES_PORT,
		username: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		dbName: process.env.POSTGRES_DB,
	},
	messageQueue: {
		host: process.env.RMQ_HOST,
		port: process.env.RMQ_PORT,
		user: process.env.RMQ_USER,
		password: process.env.RMQ_PASS,
	},
});

export const config = (): IEnvVars => {
	const env = loadEnv();
	return envFileSchema.parse(env);
};
