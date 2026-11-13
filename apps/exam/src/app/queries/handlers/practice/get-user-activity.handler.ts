import {
	UserActivity,
	buildUserActivity,
} from '../../../../domain/read-models/practice/user-activity.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetUserActivityQuery } from '../../practice/exam.get-user-activity.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

export const defaultActivityDays = 182;
export const maxActivityDays = 371;

@QueryHandler(GetUserActivityQuery)
export class GetUserActivityQueryHandler implements IQueryHandler<GetUserActivityQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetUserActivityQuery): Promise<UserActivity> {
		const { userId, days } = query.payload;
		const range = Math.min(Math.max(Math.trunc(days ?? defaultActivityDays), 1), maxActivityDays);
		const rows = await this.practiceReadRepository.getUserActivityDays(userId);
		return buildUserActivity(rows, new Date(), range);
	}
}
