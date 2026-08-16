import { HydratedIdentityReadModel } from '../../../domain/read-models/identity.read-model';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import { HydrateManyQuery } from '../auth.hydrate-many.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(HydrateManyQuery)
export class HydrateManyQueryHandler implements IQueryHandler<HydrateManyQuery> {
	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
	) {}

	async execute(query: HydrateManyQuery): Promise<HydratedIdentityReadModel[]> {
		const payload = query.payload;
		const identities = await this.identityReadRepository.hydrateMany(payload.ids);
		return identities;
	}
}
