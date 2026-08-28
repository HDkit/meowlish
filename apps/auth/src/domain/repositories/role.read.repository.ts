import { RoleReadModel } from '../read-models/role.read-model';

export interface IRoleReadRepository {
	getRoleList(): Promise<RoleReadModel[]>;
	getPermList(): Promise<string[]>;
	findByName(name: string): Promise<RoleReadModel | null>;
}

export const IRoleReadRepositoryToken = Symbol('IRoleReadRepository');
