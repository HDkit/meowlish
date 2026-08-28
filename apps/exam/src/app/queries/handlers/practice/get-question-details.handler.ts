import { FILE_CLIENT } from '../../../../constants/file';
import { DetailedQuestionInfo } from '../../../../domain/read-models/practice/detailed-question.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetQuestionDetailsQuery } from '../../practice/exam.get-question-details.query';
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

@QueryHandler(GetQuestionDetailsQuery)
export class GetQuestionDetailsQueryHandler
	implements IQueryHandler<GetQuestionDetailsQuery>, OnModuleInit
{
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: GetQuestionDetailsQuery): Promise<DetailedQuestionInfo> {
		const payload = query.payload;
		const question = await this.practiceReadRepository.getDetailedQuestionInfo(payload.questionId);

		if (!question) throw new NotFoundException('Question not found');

		const ids = new Set<string>();
		for (const id of question.fileUrls) {
			ids.add(id);
		}
		for (const section of question.sectionContext) {
			for (const id of section.fileUrls) {
				ids.add(id);
			}
		}
		try {
			const urlMap = await firstValueFrom(this.fileService.getUrls({ ids: [...ids] }));
			return {
				...question,
				fileUrls: question.fileUrls.map(id => urlMap.urls[id]).filter(url => url),
				sectionContext: question.sectionContext.map(section => ({
					...section,
					fileUrls: section.fileUrls.map(id => urlMap.urls[id]).filter(url => url),
				})),
			};
		} catch {
			throw new ServiceUnavailableException('Cannot access File sub-service');
		}
	}
}
