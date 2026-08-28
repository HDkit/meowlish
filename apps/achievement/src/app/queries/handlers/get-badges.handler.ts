import {
	type IBadgeReadRepository,
	IBadgeReadRepositoryToken,
} from '../../../domain/repositories/badge.read.repository';
import { GetBadgesQuery, GetBadgesQueryResult } from '../achievement.get-badges.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetBadgesQuery)
export class GetBadgesQueryHandler implements IQueryHandler<GetBadgesQuery> {
	constructor(
		@Inject(IBadgeReadRepositoryToken) private readonly badgeReadRepository: IBadgeReadRepository,
	) {}

	async execute(): Promise<GetBadgesQueryResult> {
		const badges = await this.badgeReadRepository.getAll();
		return { badges: badges };
	}
}
