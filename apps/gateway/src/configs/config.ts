import { DeepStringify } from '@server/typing';
import { z } from 'zod/v4';

const redisVarsSchema = z.object({
	host: z.string(),
	port: z.coerce.number(),
});

const jwtVarsSchema = z.object({
	publicKey: z.string(),
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
	notification: z.object({
		port: z.coerce.number(),
		host: z.string(),
		httpPort: z.coerce.number(),
	}),
	resource: z.object({
		/** Full `host:port`; overrides host/port when set. */
		url: z.string().optional(),
		port: z.coerce.number(),
		host: z.string(),
	}),
});

/** Comma-separated bare origins (`https://host[:port]`, no path) -> list. */
const originListSchema = z.preprocess(
	v =>
		typeof v === 'string' ?
			v
				.split(',')
				.map(o => o.trim().replace(/\/+$/, ''))
				.filter(Boolean)
		:	[],
	z.array(
		z.url().refine(o => new URL(o).origin === o, { message: 'Expected a bare origin, no path' }),
	),
);

const vpsEnvSchema = z.object({
	baseUrl: z.url(),
	feLoginRedirectUrl: z.url(),
	/**
	 * Extra frontends that may run the Google flow (`?frontend=<origin>`). Each proxies `/api/*`
	 * to this gateway, so Google calls back to `<origin>/api/v1/auth/google/callback` and the user
	 * lands on `<origin>` + the path of FE_LOGIN_REDIRECT_URL.
	 */
	googleOAuthFrontends: originListSchema,
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
	/** Origins allowed by CORS; empty means no cross-origin access. */
	corsOrigins: corsOriginsSchema,
	/** express `trust proxy`: false, true, or the number of trusted proxy hops. */
	trustProxy: z.preprocess(
		v => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v === 'true'),
		z.union([z.boolean(), z.number().int().min(0)]),
	),
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
	corsOrigins: loadCorsOrigins(),
	trustProxy: process.env.TRUST_PROXY,
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
	},
	jwt: {
		publicKey: process.env.JWT_PUBLIC_KEY,
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
		notification: {
			port: process.env.NOTIFICATION_SERVICE_PORT,
			host: process.env.NOTIFICATION_SERVICE_HOST,
			httpPort: process.env.NOTIFICATION_SERVICE_HTTP_PORT,
		},
		resource: {
			url: process.env.RESOURCE_SERVICE_URL,
			port: process.env.RESOURCE_SERVICE_PORT,
			host: process.env.RESOURCE_SERVICE_HOST,
		},
	},
	vps: {
		baseUrl: process.env.BASE_URL?.trim().replace(/\/+$/, ''),
		feLoginRedirectUrl: process.env.FE_LOGIN_REDIRECT_URL?.trim().replace(/\/+$/, ''),
		googleOAuthFrontends: process.env.GOOGLE_OAUTH_FRONTENDS,
	},
});

// validate and optionally transform your env variables here

export const config = (): IEnvVars => {
	const env = loadEnv();
	const valResult = envFileSchema.parse(env);
	return valResult;
};

// inject ConfigService<IEnvVars> to load typed env variables
