import { type CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Only the listed origins get CORS headers; credentials are on, so never `*`. */
export const corsOptions = (origins: string[]): CorsOptions => ({
	origin: origins.length > 0 ? origins : false,
	credentials: true,
});
