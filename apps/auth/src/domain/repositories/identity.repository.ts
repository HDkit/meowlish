import { LoginType } from '../../enums/login-type.enum';
import { Identity } from '../entities/identity.entity';
import { Permission, Role } from '@server/typing';

export interface IIdentityRepository {
	findOneById(id: string, deleted?: boolean): Promise<Identity | null>;
	findOneCredential(
		identifier: string,
		loginType: LoginType,
	): Promise<{ identityId: string; secretHash: string | null } | null>;
	findOneByUsername(username: string, deleted?: boolean): Promise<Identity | null>;
	getClaimsOfId(
		id: string,
		deleted?: boolean,
	): Promise<{ roles: Role[]; permissions: Permission[] } | null>;
	save(identity: Identity): Promise<void>;
	softDelete(id: string): Promise<void>;
}

export const IIdentityRepositoryToken = Symbol('IIdentityRepository');
