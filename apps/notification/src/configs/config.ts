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

/** auth gRPC address (to find the admins to notify); `url` overrides host:port. */
const authServiceSchema = z.object({
	url: z.string().optional(),
	host: z.string(),
	port: z.coerce.number(),
});

/** Listeners: gRPC on GRPC_HOST:GRPC_PORT, HTTP on HTTP_HOST:HTTP_PORT. */
const serverSchema = z.object({
	grpcHost: z.string().default('127.0.0.1'),
	grpcPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(50050)),
	httpHost: z.string().default('127.0.0.1'),
	httpPort: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().default(1520)),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	server: serverSchema,
	database: dbVarsSchema,
	messageQueue: mqSchema,
	authService: authServiceSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
	server: {
		grpcHost: process.env.GRPC_HOST,
		grpcPort: process.env.GRPC_PORT,
		httpHost: process.env.HTTP_HOST,
		httpPort: process.env.HTTP_PORT,
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
	authService: {
		url: process.env.AUTH_SERVICE_URL || undefined,
		host: process.env.AUTH_SERVICE_HOST,
		port: process.env.AUTH_SERVICE_PORT,
	},
});

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};
