import { CredentialReadModel } from '../../../domain/read-models/credential.read-model';
import {
	type ICredentialReadRepository,
	ICredentialReadRepositoryToken,
} from '../../../domain/repositories/credential.read.repository';
import { GetCredentialsQuery } from '../auth.get-credentials.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetCredentialsQuery)
export class GetCredentialsQueryHandler implements IQueryHandler<GetCredentialsQuery> {
	constructor(
		@Inject(ICredentialReadRepositoryToken)
		private readonly credentialReadRepository: ICredentialReadRepository,
	) {}

	async execute(query: GetCredentialsQuery): Promise<CredentialReadModel[]> {
		return await this.credentialReadRepository.getCredentialList(query.payload.identityId);
	}
}
