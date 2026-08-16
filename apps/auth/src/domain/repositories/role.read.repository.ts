import { RoleReadModel } from '../read-models/role.read-model';

export interface IRoleReadRepository {
	getRoleList(): Promise<RoleReadModel[]>;
	getPermList(): Promise<string[]>;
}

export const IRoleReadRepositoryToken = Symbol('IRoleReadRepository');
