import { UserBadge } from '../../domain/read-models/badge.read-model';
import { Query } from '@server/utils';

export type GetUsersBadgesQueryResult = {
	badges: UserBadge[];
	nextCursor: string;
	prevCursor: string;
};

export type GetUsersBadgesCursor = {
	// high prec
	userId: string;
	lastId?: string;
	direction?: number;
	// low prec
	limit?: number;
};

type GetUsersBadgesQueryPayload = {
	cursor?: string;
} & GetUsersBadgesCursor;

export class GetUsersBadgesQuery extends Query<
	GetUsersBadgesQueryResult,
	GetUsersBadgesQueryPayload
> {}
