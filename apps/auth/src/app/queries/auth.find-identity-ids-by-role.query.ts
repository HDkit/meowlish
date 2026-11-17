import { Query } from '@server/utils';

export type FindIdentityIdsByRoleQueryPayload = { role: string };

export class FindIdentityIdsByRoleQuery extends Query<
	string[],
	FindIdentityIdsByRoleQueryPayload
> {}
