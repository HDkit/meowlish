import {
	type IRoleReadRepository,
	IRoleReadRepositoryToken,
} from '../../../domain/repositories/role.read.repository';
import { GetPermissionsQuery } from '../auth.get-permissions.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetPermissionsQuery)
export class GetPermissionsQueryHandler implements IQueryHandler<GetPermissionsQuery> {
	constructor(
		@Inject(IRoleReadRepositoryToken) private readonly roleReadRepository: IRoleReadRepository,
	) {}

	async execute(): Promise<string[]> {
		return await this.roleReadRepository.getPermList();
	}
}
