import { CredentialReadModel } from '../read-models/credential.read-model';

export interface ICredentialReadRepository {
	getCredentialList(identityId: string): Promise<CredentialReadModel[]>;
}

export const ICredentialReadRepositoryToken = Symbol('ICredentialReadRepository');
