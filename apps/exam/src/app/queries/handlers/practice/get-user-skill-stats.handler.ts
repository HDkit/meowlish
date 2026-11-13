import {
	UserSkillStats,
	buildUserSkillStats,
} from '../../../../domain/read-models/practice/user-skill-stats.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetUserSkillStatsQuery } from '../../practice/exam.get-user-skill-stats.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

/** How many of the latest finished attempts the skill stats look at. */
export const skillStatsAttemptLimit = 100;

@QueryHandler(GetUserSkillStatsQuery)
export class GetUserSkillStatsQueryHandler implements IQueryHandler<GetUserSkillStatsQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetUserSkillStatsQuery): Promise<UserSkillStats> {
		const source = await this.practiceReadRepository.getUserSkillStatsSource(
			query.payload.userId,
			skillStatsAttemptLimit,
		);
		return buildUserSkillStats(source);
	}
}
