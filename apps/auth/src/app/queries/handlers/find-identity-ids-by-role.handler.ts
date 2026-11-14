import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import { FindIdentityIdsByRoleQuery } from '../auth.find-identity-ids-by-role.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

/** Upper bound on one role's members returned at once (roles like Admin are small). */
export const MAX_ROLE_MEMBERS = 500;

@QueryHandler(FindIdentityIdsByRoleQuery)
export class FindIdentityIdsByRoleQueryHandler implements IQueryHandler<FindIdentityIdsByRoleQuery> {
	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
	) {}

	async execute(query: FindIdentityIdsByRoleQuery): Promise<string[]> {
		return await this.identityReadRepository.findIdentityIdsByRole(
			query.payload.role,
			MAX_ROLE_MEMBERS,
		);
	}
}
