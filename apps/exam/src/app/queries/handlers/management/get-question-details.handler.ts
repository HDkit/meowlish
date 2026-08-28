import { FILE_CLIENT } from '../../../../constants/file';
import { QuestionManagementInfo } from '../../../../domain/read-models/management/question-info.read-model';
import {
	type IManagementReadRepository,
	IManagementReadRepositoryToken,
} from '../../../../domain/repositories/management.read.repository';
import { GetQuestionManagementDetailsQuery } from '../../management/exam.get-question-details.query';
import {
	Inject,
	NotFoundException,
	OnModuleInit,
	ServiceUnavailableException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(GetQuestionManagementDetailsQuery)
export class GetQuestionManagementDetailsQueryHandler
	implements IQueryHandler<GetQuestionManagementDetailsQuery>, OnModuleInit
{
	private fileService!: file.FileServiceClient;

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}
	constructor(
		@Inject(IManagementReadRepositoryToken)
		private readonly managementReadRepository: IManagementReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	async execute(query: GetQuestionManagementDetailsQuery): Promise<QuestionManagementInfo> {
		const payload = query.payload;
		const question = await this.managementReadRepository.getQuestionDetail(payload.questionId);

		if (!question) throw new NotFoundException('Question not found');

		try {
			const urlMap = await firstValueFrom(
				this.fileService.getUrls({ ids: question.files.map(f => f.id) }),
			);
			question.files.forEach(f => (f.url = urlMap.urls[f.id]));
		} catch {
			throw new ServiceUnavailableException('Cannot access File sub-service');
		}
		return question;
	}
}
