import { UserActivity } from '../../../domain/read-models/practice/user-activity.read-model';
import { Query } from '@server/utils';

export type GetUserActivityQueryPayload = {
	userId: string;
	/** UTC days back from today, today included */
	days?: number;
	/** or an explicit range of UTC days (YYYY-MM-DD, both included); both or neither, not with days */
	from?: string;
	to?: string;
};

export class GetUserActivityQuery extends Query<UserActivity, GetUserActivityQueryPayload> {}
