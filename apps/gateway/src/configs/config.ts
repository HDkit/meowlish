import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const redisVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number(),
});

const jwtVarsSchema = z.object({
	accessSecret: z.string(),
	refreshSecret: z.string(),
});

const googleOAuth2Schema = z.object({
	clientId: z.string(),
	secret: z.string(),
});

const servicesSchema = z.object({
	auth: z.object({
		port: z.coerce.number(),
		host: z.string(),
	}),
	exam: z.object({
		port: z.coerce.number(),
		host: z.string(),
	}),
	file: z.object({
		port: z.coerce.number(),
		host: z.string(),
	}),
	achievement: z.object({
		port: z.coerce.number(),
		host: z.string(),
	}),
	live: z.object({
		port: z.coerce.number(),
		host: z.string(),
		portWs: z.coerce.number(),
		hostWs: z.string(),
	}),
});

const vpsEnvSchema = z.object({
	baseUrl: z.url(),
});

export const envFileSchema = z.object({
	env: z.union([z.literal('development'), z.literal('production')]),
	redis: redisVarsSchema,
	jwt: jwtVarsSchema,
	googleOAuth2: googleOAuth2Schema,
	microservicesConnection: servicesSchema,
	vps: vpsEnvSchema,
});

export type IEnvVars = z.infer<typeof envFileSchema>;

// map your env vars to ConfigService's properties
const loadEnv = (): DeepStringify<IEnvVars> => ({
	env: process.env.NODE_ENV,
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
	},
	jwt: {
		accessSecret: process.env.JWT_SECRET,
		refreshSecret: process.env.JWT_REFRESH_SECRET,
	},
	googleOAuth2: {
		clientId: process.env.GOOGLE_OA2_CLIENT_ID,
		secret: process.env.GOOGLE_OA2_CLIENT_SECRET,
	},
	microservicesConnection: {
		auth: {
			port: process.env.AUTH_SERVICE_PORT,
			host: process.env.AUTH_SERVICE_HOST,
		},
		exam: {
			port: process.env.EXAM_SERVICE_PORT,
			host: process.env.EXAM_SERVICE_HOST,
		},
		file: {
			port: process.env.FILE_SERVICE_PORT,
			host: process.env.FILE_SERVICE_HOST,
		},
		achievement: {
			port: process.env.ACHIEVEMENT_SERVICE_PORT,
			host: process.env.ACHIEVEMENT_SERVICE_HOST,
		},
		live: {
			port: process.env.LIVE_SERVICE_PORT,
			host: process.env.LIVE_SERVICE_HOST,
			portWs: process.env.LIVE_SERVICE_WS_PORT,
			hostWs: process.env.LIVE_SERVICE_WS_HOST,
		},
	},
	vps: { baseUrl: process.env.BASE_URL?.trim().replace(/\/+$/, '') },
});

// validate and optionally transform your env variables here

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};

// inject ConfigService<IEnvVars> to load typed env variables
