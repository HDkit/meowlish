import { AttemptHistorySummary } from '../../../domain/read-models/practice/attempt-history-summary.read-model';
import { Query } from '@server/utils';

export type UsersCalendar = {
	history: AttemptHistorySummary;
};

export type GetUsersCalendarQueryPayload = {
	userId: string;
	range?: {
		from: Date;
		to: Date;
	};
};

export class GetUserCalendarQuery extends Query<UsersCalendar, GetUsersCalendarQueryPayload> {}
