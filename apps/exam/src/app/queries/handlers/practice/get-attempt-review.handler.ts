import { FILE_CLIENT } from '../../../../constants/file';
import { DetailedAttemptReviewData } from '../../../../domain/read-models/practice/attempt-review.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetAttemptReviewQuery } from '../../practice/exam.get-attempt-review.query';
import { Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(GetAttemptReviewQuery)
export class GetAttemptReviewQueryHandler implements IQueryHandler<GetAttemptReviewQuery> {
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: GetAttemptReviewQuery): Promise<DetailedAttemptReviewData> {
		const payload = query.payload;
		const review = await this.practiceReadRepository.getAttemptReview(payload.attemptId);

		if (!review) throw new NotFoundException('Attempt not found');

		const ids = new Set<string>();
		this.treeVisitor(review.sections, this.collectFileIds.bind(this), ids);
		try {
			const urlMap = await firstValueFrom(this.fileService.getUrls({ ids: [...ids] }));
			this.treeVisitor(review.sections, this.assignFileUrls.bind(this), urlMap.urls);
		} catch {
			throw new ServiceUnavailableException('Cannot access File sub-service');
		}
		return review;
	}

	treeVisitor<TArgs extends unknown[]>(
		tree: DetailedAttemptReviewData['sections'],
		callback: (
			node:
				| DetailedAttemptReviewData['sections'][number]
				| DetailedAttemptReviewData['sections'][number]['questions'][number],
			...args: TArgs
		) => void,
		...args: TArgs
	) {
		for (const section of tree) {
			callback(section, ...args);
			for (const question of section.questions) callback(question, ...args);
			if (section.sections.length > 0) this.treeVisitor(section.sections, callback, ...args);
		}
	}

	collectFileIds(
		node:
			| DetailedAttemptReviewData['sections'][number]
			| DetailedAttemptReviewData['sections'][number]['questions'][number],
		ids: Set<string>,
	): void {
		for (const id of node.fileUrls) ids.add(id);
	}

	assignFileUrls(
		node:
			| DetailedAttemptReviewData['sections'][number]
			| DetailedAttemptReviewData['sections'][number]['questions'][number],
		urls: { [key: string]: string },
	): void {
		node.fileUrls = node.fileUrls.map(id => urls[id]).filter(url => url);
	}
}
