import { FindIdentitiesQueryHandler } from './find-identities.handler';
import { FindIdentityIdsQueryHandler } from './find-identity-ids.handler';
import { GetCredentialsQueryHandler } from './get-credentials.handler';
import { GetPermissionsQueryHandler } from './get-permissions.handler';
import { GetRolesQueryHandler } from './get-roles.handler';
import { HydrateManyQueryHandler } from './hydrate-many.handler';
import { HydrateQueryHandler } from './hydrate.handler';

export const AuthQueryHandlers = [
	FindIdentitiesQueryHandler,
	FindIdentityIdsQueryHandler,
	GetRolesQueryHandler,
	GetPermissionsQueryHandler,
	GetCredentialsQueryHandler,
	HydrateManyQueryHandler,
	HydrateQueryHandler,
];
