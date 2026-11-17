import { HydratedIdentityReadModel, IdentityReadModel } from '../read-models/identity.read-model';

export interface IIdentityReadRepository {
	findIdentityIds(options?: {
		usernameOrCredentialIdentifier?: string;
		/** Only match usernames (public searches must not probe credential identifiers). */
		usernameOnly?: boolean;
		lastId?: string;
		limit?: number;
		direction?: number;
	}): Promise<string[]>;
	findIdentities(options?: {
		usernameOrCredentialIdentifierOrId?: string;
		/** Only match usernames (public searches must not probe credential identifiers or ids). */
		usernameOnly?: boolean;
		hasRoles?: string[];
		hasPerms?: string[];
		lastId?: string;
		limit?: number;
		direction?: number;
	}): Promise<IdentityReadModel[]>;
	findIdentitiesByPhone(options: {
		phoneNumber: string;
		lastId?: string;
		limit?: number;
		direction?: number;
	}): Promise<IdentityReadModel[]>;
	/** Active (not locked, not deleted) identities holding the role, at most `limit`. */
	findIdentityIdsByRole(role: string, limit: number): Promise<string[]>;
	hydrate(id: string): Promise<HydratedIdentityReadModel | null>;
	hydrateMany(ids: string[]): Promise<HydratedIdentityReadModel[]>;
}

export const IIdentityReadRepositoryToken = Symbol('IIdentityReadRepository');
