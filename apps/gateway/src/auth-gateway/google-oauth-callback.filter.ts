import { type GoogleOAuthRequest } from '../auth/guards/google-oauth2.guard';
import { IEnvVars } from '../configs/config';
import { GoogleOAuthError } from '../enums/google-oauth-error.enum';
import { resolveGoogleOAuthFrontend } from './google-oauth-frontends';
import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gRPC2HttpExceptionFilter } from '@server/utils';
import { Response } from 'express';

/** A Google flow failure that already knows which `?error=` the frontend should get. */
export class GoogleOAuthException extends HttpException {
	constructor(
		public readonly code: GoogleOAuthError,
		status: HttpStatus,
	) {
		super(code, status);
	}
}

/** HTTP status of an HttpException or of a raw gRPC client error; undefined otherwise. */
const statusOf = (exception: unknown): number | undefined => {
	if (exception instanceof HttpException) return exception.getStatus();
	const grpcCode = (exception as { code?: unknown } | null)?.code;
	return typeof grpcCode === 'number' ?
			gRPC2HttpExceptionFilter.gRPCStatusCode[grpcCode]
		:	undefined;
};

export const googleOAuthErrorOf = (
	exception: unknown,
	request: GoogleOAuthRequest,
): GoogleOAuthError => {
	if (exception instanceof GoogleOAuthException) return exception.code;
	// passport turns Google's ?error=access_denied into a plain 401
	if (request.query['error'] === 'access_denied') return GoogleOAuthError.Cancelled;
	switch (statusOf(exception)) {
		case HttpStatus.UNAUTHORIZED:
			return GoogleOAuthError.SessionExpired;
		case HttpStatus.FORBIDDEN:
			return GoogleOAuthError.Forbidden;
		default:
			return GoogleOAuthError.Failed;
	}
};

/**
 * /google/callback is a top-level navigation, so an error must not end as a JSON body in the
 * browser. Redirects to the frontend's login callback page instead, with `?error=<code>` and
 * `flow=link` for the linking flow, so the frontend can show a message and go back where it was.
 */
@Catch()
@Injectable()
export class GoogleOAuthCallbackFilter implements ExceptionFilter {
	// Nest's Logger: bootstrap.ts routes it to AppLoggerService (`useLogger`), and the filter needs
	// no provider from LoggerModule, which AuthRouterModule doesn't import.
	private readonly logger = new Logger(GoogleOAuthCallbackFilter.name);

	constructor(private readonly configService: ConfigService<IEnvVars>) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const http = host.switchToHttp();
		const request = http.getRequest<GoogleOAuthRequest>();
		const response = http.getResponse<Response>();
		const code = googleOAuthErrorOf(exception, request);
		if (code === GoogleOAuthError.Failed) {
			this.logger.error(
				'Google callback failed',
				exception instanceof Error ? exception.stack : String(exception),
			);
		}

		const flow = request.googleOAuth;
		// The flow is unknown only when the state couldn't be read; the default frontend then.
		const frontend =
			flow?.frontend ??
			resolveGoogleOAuthFrontend(this.configService.getOrThrow('vps', { infer: true }));
		if (!frontend) {
			response.status(HttpStatus.BAD_REQUEST).json({ error: code });
			return;
		}
		const url = new URL(frontend.loginRedirectUrl);
		url.searchParams.set('error', code);
		if (flow?.identityId) url.searchParams.set('flow', 'link');
		response.redirect(url.toString());
	}
}
