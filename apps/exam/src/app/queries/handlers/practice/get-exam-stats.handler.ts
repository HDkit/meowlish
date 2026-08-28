import { ExamStatistics } from '../../../../domain/read-models/practice/exam-statistics.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetExamStatsQuery } from '../../practice/exam.get-exam-stats.query';
import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetExamStatsQuery)
export class GetExamStatsQueryHandler implements IQueryHandler<GetExamStatsQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetExamStatsQuery): Promise<ExamStatistics> {
		const payload = query.payload;
		const examStats = await this.practiceReadRepository.getExamStats(payload.examId);

		if (!examStats) throw new NotFoundException('Exam not found');

		return examStats;
	}
}
