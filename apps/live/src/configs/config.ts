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

const DEV_CORS_ORIGINS = 'http://localhost:6767,http://localhost:5173';

/** Comma-separated origins -> list. Never contains `*`: credentials are always allowed. */
const corsOriginsSchema = z.preprocess(
	v =>
		typeof v === 'string' ?
			v
				.split(',')
				.map(o => o.trim().replace(/\/+$/, ''))
				.filter(o => o && o !== '*')
		:	[],
	z.array(z.string()),
);

/** CORS_ORIGINS, or the local dev front-ends when unset outside production. */
const loadCorsOrigins = () =>
	process.env.CORS_ORIGINS ?? (process.env.NODE_ENV === 'production' ? '' : DEV_CORS_ORIGINS);

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	/** Origins allowed by CORS (HTTP and socket.io); empty means no cross-origin access. */
	corsOrigins: corsOriginsSchema,
	/** Signs pagination cursors (see CursorPaginationFactory). */
	cursorSecret: z.string().min(32).optional(),
	/** RS256 public key matching auth's JWT_PRIVATE_KEY; sockets are rejected without it. */
	jwtPublicKey: z.string().optional(),
	database: dbVarsSchema,
	redis: redisVarsSchema,
	messageQueue: mqSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

// map your env vars to ConfigService's properties
const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
	corsOrigins: loadCorsOrigins(),
	cursorSecret: process.env.CURSOR_SECRET || undefined,
	jwtPublicKey: process.env.JWT_PUBLIC_KEY || undefined,
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
});

// validate and optionally transform your env variables here

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};

// inject ConfigService<IEnvVars> to load typed env variables
