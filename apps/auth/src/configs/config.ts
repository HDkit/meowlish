import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const dbVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number().default(5432),
	username: z.string(),
	password: z.string(),
	dbName: z.string(),
});

const redisVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number(),
});

const jwtVarsSchema = z.object({
	accessSecret: z.string(),
	refreshSecret: z.string(),
	accessTokenExpiration: z.coerce.number().default(15 * 60), // 15 minutes in seconds
	refreshTokenExpiration: z.coerce.number().default(7 * 24 * 60 * 60), // 7 days in seconds
});

const googleOAuth2VarsSchema = z.object({
	clientId: z.string(),
	secret: z.string(),
});

const mqSchema = z.object({
	user: z.string(),
	password: z.string(),
	host: z.string(),
	port: z.coerce.number(),
});

const servicesSchema = z.object({
	file: z.object({
		port: z.coerce.number(),
		host: z.string(),
	}),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	database: dbVarsSchema,
	redis: redisVarsSchema,
	jwt: jwtVarsSchema,
	googleOAuth2: googleOAuth2VarsSchema,
	messageQueue: mqSchema,
	microservicesConnection: servicesSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

// map your env vars to ConfigService's properties
const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
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
	jwt: {
		accessSecret: process.env.JWT_SECRET,
		refreshSecret: process.env.JWT_REFRESH_SECRET,
		accessTokenExpiration: process.env.JWT_ACCESS_TOKEN_EXPIRATION,
		refreshTokenExpiration: process.env.JWT_REFRESH_TOKEN_EXPIRATION,
	},
	googleOAuth2: {
		clientId: process.env.GOOGLE_OA2_CLIENT_ID,
		secret: process.env.GOOGLE_OA2_CLIENT_SECRET,
	},
	messageQueue: {
		host: process.env.RMQ_HOST,
		port: process.env.RMQ_PORT,
		user: process.env.RMQ_USER,
		password: process.env.RMQ_PASS,
	},
	microservicesConnection: {
		file: {
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
