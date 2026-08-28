import { FindIdentitiesByPhoneQueryHandler } from './find-identities-by-phone.handler';
import { FindIdentitiesQueryHandler } from './find-identities.handler';
import { FindIdentityIdsQueryHandler } from './find-identity-ids.handler';
import { GetCredentialsQueryHandler } from './get-credentials.handler';
import { GetGoogleCalendarTokenQueryHandler } from './get-google-calendar-token.handler';
import { GetPermissionsQueryHandler } from './get-permissions.handler';
import { GetRolesQueryHandler } from './get-roles.handler';
import { HydrateManyQueryHandler } from './hydrate-many.handler';
import { HydrateQueryHandler } from './hydrate.handler';

export const AuthQueryHandlers = [
	FindIdentitiesQueryHandler,
	FindIdentitiesByPhoneQueryHandler,
	FindIdentityIdsQueryHandler,
	GetRolesQueryHandler,
	GetPermissionsQueryHandler,
	GetCredentialsQueryHandler,
	GetGoogleCalendarTokenQueryHandler,
	HydrateManyQueryHandler,
	HydrateQueryHandler,
];
