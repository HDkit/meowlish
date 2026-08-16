import { Progress } from '../../../domain/read-models/progress.read-model';
import {
	type IBadgeReadRepository,
	IBadgeReadRepositoryToken,
} from '../../../domain/repositories/badge.read.repository';
import { GetUsersProgressQuery } from '../achievement.get-users-progress.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetUsersProgressQuery)
export class GetUsersProgressQueryHandler implements IQueryHandler<GetUsersProgressQuery> {
	constructor(
		@Inject(IBadgeReadRepositoryToken) private readonly badgeReadRepository: IBadgeReadRepository,
	) {}

	async execute(query: GetUsersProgressQuery): Promise<Progress> {
		return await this.badgeReadRepository.getUsersProgress(query.payload.userId);
	}
}
