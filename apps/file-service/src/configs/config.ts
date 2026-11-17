import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const dbVarsSchema = z.object({
	host: z.string(),
	port: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().default(5432)),
	username: z.string(),
	password: z.string(),
	dbName: z.string(),
});

const redisVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number(),
});

const objStorageVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number().optional(),
	user: z.string(),
	password: z.string(),
	// unset => TLS only in production (previous behaviour)
	useSSL: z
		.enum(['true', 'false'])
		.optional()
		.transform(v => (v === undefined ? undefined : v === 'true')),
	// browser-facing base for public objects, e.g. https://cdn.example.com or http://localhost:9000
	publicUrl: z.preprocess(v => (v === '' ? undefined : v), z.url().optional()),
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
	port: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(50050)),
	healthPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(9106)),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	server: serverSchema,
	database: dbVarsSchema,
	redis: redisVarsSchema,
	objStorage: objStorageVarsSchema,
	messageQueue: mqSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

// map your env vars to ConfigService's properties
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
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
	},
	objStorage: {
		host: process.env.MINIO_HOST,
		port: process.env.MINIO_PORT,
		user: process.env.MINIO_USER,
		password: process.env.MINIO_PASSWORD,
		useSSL: process.env.MINIO_USE_SSL,
		publicUrl: process.env.MINIO_PUBLIC_URL,
	},
	messageQueue: {
		host: process.env.RMQ_HOST,
		port: process.env.RMQ_PORT,
		user: process.env.RMQ_USER,
		password: process.env.RMQ_PASS,
	},
});

// validate and optionally transform your env variables here

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};

// inject ConfigService<IEnvVars> to load typed env variables
