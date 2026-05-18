import { Query } from '@server/utils';

export type FindIdentityIdsQueryResult = {
	ids: string[];
	nextCursor: string;
	prevCursor: string;
};

export type FindIdentityIdsQueryPayload = {
	cursor?: string;
} & Omit<FindIdentityIdsCursor, 'lastId'>;

export type FindIdentityIdsCursor = {
	// high prec
	usernameOrCredential?: string;
	lastId?: string;
	direction?: number;
	// low prec
	limit?: number;
};

export class FindIdentityIdsQuery extends Query<
	FindIdentityIdsQueryResult,
	FindIdentityIdsQueryPayload
> {}
