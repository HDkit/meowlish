import { DetailedExamInfo } from '../../../../domain/read-models/practice/detailed-exam.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetExamDetailsQuery } from '../../practice/exam.get-exam-details.query';
import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetExamDetailsQuery)
export class GetExamDetailsQueryHandler implements IQueryHandler<GetExamDetailsQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetExamDetailsQuery): Promise<DetailedExamInfo> {
		const payload = query.payload;
		const exam = await this.practiceReadRepository.getExamDetail(payload.examId);

		if (!exam) throw new NotFoundException('Exam not found');

		return exam;
	}
}
