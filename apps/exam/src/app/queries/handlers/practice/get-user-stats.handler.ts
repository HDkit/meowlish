import { UserStats } from '../../../../domain/read-models/practice/user-stats.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetUserStatsQuery } from '../../practice/exam.get-user-stats.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetUserStatsQuery)
export class GetUserStatsQueryHandler implements IQueryHandler<GetUserStatsQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetUserStatsQuery): Promise<UserStats> {
		const payload = query.payload;
		const userStats = await this.practiceReadRepository.getUserStats(payload.userId);
		return userStats;
	}
}
