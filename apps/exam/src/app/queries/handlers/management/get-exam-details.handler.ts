import { ExamManagementDetailedInfo } from '../../../../domain/read-models/management/exam-info.read-model';
import {
	type IManagementReadRepository,
	IManagementReadRepositoryToken,
} from '../../../../domain/repositories/management.read.repository';
import { GetExamManagementDetailsQuery } from '../../management/exam.get-exam-details.query';
import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetExamManagementDetailsQuery)
export class GetExamManagementDetailsQueryHandler
	implements IQueryHandler<GetExamManagementDetailsQuery>
{
	constructor(
		@Inject(IManagementReadRepositoryToken)
		private readonly managementReadRepository: IManagementReadRepository,
	) {}

	async execute(query: GetExamManagementDetailsQuery): Promise<ExamManagementDetailedInfo> {
		const payload = query.payload;
		const exam = await this.managementReadRepository.getExamDetail(payload.examId);

		if (!exam) throw new NotFoundException('Exam not found');

		return exam;
	}
}
