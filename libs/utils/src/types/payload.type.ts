import { Permission, Role } from '@server/typing';
import { z } from 'zod/v4';

export const payloadSchema = z.object({
	sub: z.string(),
	roles: z.array(z.enum(Role)),
	permissions: z.array(z.enum(Permission)),
	iat: z.coerce.number(),
	iatMs: z.coerce.number().optional(),
	exp: z.coerce.number(),
});

export const refreshPayloadSchema = payloadSchema.omit({
	roles: true,
	permissions: true,
});

export type AuthPayload = z.infer<typeof payloadSchema>;

export type AuthRefreshPayload = z.infer<typeof refreshPayloadSchema>;

// to create new payload from payload extracted from json
export const recreatePayload = (extractedPayload: AuthPayload) => {
	const parsedPayload = payloadSchema.parse(extractedPayload);
	return parsedPayload;
};
