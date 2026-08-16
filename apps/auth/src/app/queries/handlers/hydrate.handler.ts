import { HydratedIdentityReadModel } from '../../../domain/read-models/identity.read-model';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import { HydrateQuery } from '../auth.hydrate.query';
import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(HydrateQuery)
export class HydrateQueryHandler implements IQueryHandler<HydrateQuery> {
	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
	) {}

	async execute(query: HydrateQuery): Promise<HydratedIdentityReadModel> {
		const payload = query.payload;
		const identity = await this.identityReadRepository.hydrate(payload.id);
		if (!identity) throw new NotFoundException('IdentityNotFound');
		return identity;
	}
}
