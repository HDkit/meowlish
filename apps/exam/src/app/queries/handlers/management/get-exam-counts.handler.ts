import {
	type IManagementReadRepository,
	IManagementReadRepositoryToken,
	type ExamCounts,
} from '../../../../domain/repositories/management.read.repository';
import { GetExamCountsQuery } from '../../management/exam.get-counts.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetExamCountsQuery)
export class GetExamCountsHandler implements IQueryHandler<GetExamCountsQuery> {
	constructor(
		@Inject(IManagementReadRepositoryToken)
		private readonly managementReadRepository: IManagementReadRepository,
	) {}

	async execute(): Promise<ExamCounts> {
		return this.managementReadRepository.getExamCounts();
	}
}
