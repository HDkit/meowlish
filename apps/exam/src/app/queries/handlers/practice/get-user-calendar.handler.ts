import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetUserCalendarQuery, UsersCalendar } from '../../practice/exam.get-user-calendar.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetUserCalendarQuery)
export class GetUserCalendarQueryHandler implements IQueryHandler<GetUserCalendarQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetUserCalendarQuery): Promise<UsersCalendar> {
		const payload = query.payload;
		const calendar = await this.practiceReadRepository.getUsersAttemptSummary(
			payload.userId,
			payload.range,
		);
		return { history: calendar };
	}
}
