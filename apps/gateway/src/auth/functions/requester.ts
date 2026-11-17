import { Role } from '@server/typing';
import { Claims } from '@server/utils';

export const hasAnyRole = (user: Claims, roles: readonly Role[]): boolean =>
	roles.some(role => user.roles.includes(role));

/**
 * Identity forwarded to services that scope data by caller. Always derived from the verified JWT,
 * never from client input. `privileged` lets the service skip ownership/visibility checks.
 */
export const requesterOf = (
	user: Claims,
	privilegedRoles: readonly Role[],
): { requesterId: string; privileged: boolean } => ({
	requesterId: user.sub,
	privileged: hasAnyRole(user, privilegedRoles),
});
