import { UserStats } from '../../../domain/read-models/practice/user-stats.read-model';
import { Query } from '@server/utils';

export type GetUsersStatsQueryPayload = {
	userId: string;
};

export class GetUserStatsQuery extends Query<UserStats, GetUsersStatsQueryPayload> {}
