import { HydratedIdentityReadModel, IdentityReadModel } from '../read-models/identity.read-model';

export interface IIdentityReadRepository {
	findIdentityIds(options?: {
		usernameOrCredentialIdentifier?: string;
		lastId?: string;
		limit?: number;
	}): Promise<string[]>;
	findIdentities(options?: {
		usernameOrCredentialIdentifierOrId?: string;
		hasRoles?: string[];
		hasPerms?: string[];
		lastId?: string;
		limit?: number;
	}): Promise<IdentityReadModel[]>;
	hydrate(id: string): Promise<HydratedIdentityReadModel | null>;
	hydrateMany(ids: string[]): Promise<HydratedIdentityReadModel[]>;
}

export const IIdentityReadRepositoryToken = Symbol('IIdentityReadRepository');
