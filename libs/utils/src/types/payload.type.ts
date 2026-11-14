import { Permission, Role, TokenType } from '@server/typing';
import { z } from 'zod/v4';

export const payloadSchema = z.object({
	sub: z.string(),
	roles: z.array(z.enum(Role)),
	permissions: z.array(z.enum(Permission)),
	iat: z.coerce.number(),
	iatMs: z.coerce.number().optional(),
	exp: z.coerce.number(),
	/** Absent on tokens issued before the claim existed. */
	typ: z.enum(TokenType).optional(),
});

export const refreshPayloadSchema = payloadSchema.omit({
	roles: true,
	permissions: true,
});

/**
 * Access and refresh tokens share the signing key, so a check of the signature alone accepts
 * either. Tokens carry `typ`; older ones (no `typ`) are told apart by shape: only access tokens
 * carry `roles`/`permissions`.
 */
const hasClaims = (payload: object): boolean => 'roles' in payload || 'permissions' in payload;

/** A refresh token: `typ` REFRESH, or a pre-`typ` token without roles/permissions. */
export const isRefreshTokenPayload = (payload: unknown): boolean => {
	if (typeof payload !== 'object' || payload === null) return false;
	const typ = 'typ' in payload ? payload.typ : undefined;
	return typ === TokenType.Refresh || (typ === undefined && !hasClaims(payload));
};

/** An access token: `typ` ACCESS, or a pre-`typ` token that carries roles/permissions. */
export const isAccessTokenPayload = (payload: unknown): boolean => {
	if (typeof payload !== 'object' || payload === null) return false;
	const typ = 'typ' in payload ? payload.typ : undefined;
	return typ === TokenType.Access || (typ === undefined && hasClaims(payload));
};

export type AuthPayload = z.infer<typeof payloadSchema>;

export type AuthRefreshPayload = z.infer<typeof refreshPayloadSchema>;

// to create new payload from payload extracted from json
export const recreatePayload = (extractedPayload: AuthPayload) => {
	const parsedPayload = payloadSchema.parse(extractedPayload);
	return parsedPayload;
};
