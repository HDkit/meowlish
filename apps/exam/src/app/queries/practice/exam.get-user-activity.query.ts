import { UserActivity } from '../../../domain/read-models/practice/user-activity.read-model';
import { Query } from '@server/utils';

export type GetUserActivityQueryPayload = {
	userId: string;
	/** UTC days back from today, today included */
	days?: number;
};

export class GetUserActivityQuery extends Query<UserActivity, GetUserActivityQueryPayload> {}
