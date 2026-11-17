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

const mqSchema = z.object({
	user: z.string(),
	password: z.string(),
	host: z.string(),
	port: z.coerce.number(),
});

const servicesSchema = z.object({
	file: z.object({
		/** Full `host:port`; overrides host/port when set. */
		url: z.string().optional(),
		port: z.coerce.number(),
		host: z.string(),
	}),
});

/** Listeners: gRPC on HOST:PORT, health HTTP on HOST:HEALTH_PORT. */
const serverSchema = z.object({
	host: z.string().default('127.0.0.1'),
	port: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(50050)),
	healthPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(9102)),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	server: serverSchema,
	/** Signs pagination cursors (see CursorPaginationFactory). */
	cursorSecret: z.string().min(32).optional(),
	database: dbVarsSchema,
	redis: redisVarsSchema,
	messageQueue: mqSchema,
	microservicesConnection: servicesSchema,
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
	cursorSecret: process.env.CURSOR_SECRET || undefined,
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
	messageQueue: {
		host: process.env.RMQ_HOST,
		port: process.env.RMQ_PORT,
		user: process.env.RMQ_USER,
		password: process.env.RMQ_PASS,
	},
	microservicesConnection: {
		file: {
			url: process.env.FILE_SERVICE_URL,
			port: process.env.FILE_SERVICE_PORT,
			host: process.env.FILE_SERVICE_HOST,
		},
	},
});

// validate and optionally transform your env variables here

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};

// inject ConfigService<IEnvVars> to load typed env variables
