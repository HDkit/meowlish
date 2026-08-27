import { IdentityReadModel } from '../../domain/read-models/identity.read-model';
import { Query } from '@server/utils';

export type FindIdentitiesQueryResult = {
	identities: IdentityReadModel[];
	nextCursor: string;
	prevCursor: string;
};

export type FindIdentitiesQueryPayload = {
	cursor?: string;
} & Omit<FindIdentitiesCursor, 'lastId'>;

export type FindIdentitiesCursor = {
	// high prec
	usernameOrCredentialOrId?: string;
	hasRoles?: string[];
	hasPerms?: string[];
	lastId?: string;
	direction?: number;
	// low prec
	limit?: number;
};

export class FindIdentitiesQuery extends Query<
	FindIdentitiesQueryResult,
	FindIdentitiesQueryPayload
> {}
