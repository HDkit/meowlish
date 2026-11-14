import { Claims } from '@server/utils';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
	user: Claims;
}

/** What JwtRefreshStrategy puts on `req.user`: the claims plus the presented refresh token. */
export interface RefreshClaims extends Claims {
	refreshToken: { jti: string; family?: string };
}

export interface RefreshRequest extends Request {
	user: RefreshClaims;
}
