import { IEnvVars } from '../../configs/config';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Login-CSRF / forced-logout guard for routes that set or clear the session cookies.
 * SameSite=Lax doesn't stop a cross-site top-level navigation or form POST from *receiving*
 * Set-Cookie, so those requests are refused here:
 * - `Sec-Fetch-Site: cross-site` (modern browsers send it on every request) -> 403;
 * - an `Origin` that is neither a configured CORS origin nor the gateway itself (Swagger UI) -> 403.
 * Requests with neither header (curl, mobile apps, server-to-server) pass.
 */
@Injectable()
export class CookieIssuanceGuard implements CanActivate {
	constructor(private readonly configService: ConfigService<IEnvVars>) {}

	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest<Request>();
		if (req.headers['sec-fetch-site'] === 'cross-site') {
			throw new ForbiddenException('Cross-site request refused');
		}
		const origin = req.headers.origin;
		if (origin === undefined) return true;
		const allowed = this.configService.getOrThrow('corsOrigins', { infer: true });
		const self = `${req.protocol}://${req.get('host')}`;
		if (origin === self || allowed.includes(origin)) return true;
		throw new ForbiddenException('Origin not allowed');
	}
}
