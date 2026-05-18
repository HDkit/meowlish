import { FILE_CLIENT } from '../../../constants/file';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import {
	FindIdentitiesByPhoneQuery,
	FindIdentitiesByPhoneQueryResult,
} from '../auth.find-identities-by-phone.query';
import { Inject, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(FindIdentitiesByPhoneQuery)
export class FindIdentitiesByPhoneQueryHandler
	implements IQueryHandler<FindIdentitiesByPhoneQuery>, OnModuleInit
{
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: FindIdentitiesByPhoneQuery): Promise<FindIdentitiesByPhoneQueryResult> {
		const payload = query.payload;

		const identities = await this.identityReadRepository.findIdentitiesByPhone({
			phoneNumber: payload.phoneNumber,
			lastId: payload.lastId,
			limit: payload.limit,
		});

		try {
			const ids = identities.map(i => i.avatarUrl).filter((i): i is string => !!i);
			const urlMap = await firstValueFrom(this.fileService.getUrls({ ids: [...ids] }));
			identities.forEach(i => {
				if (i.avatarUrl) i.avatarUrl = urlMap.urls[i.avatarUrl];
			});
		} catch {
			throw new ServiceUnavailableException('Cannot access File sub-service');
		}

		return {
			identities: identities,
			cursor: '',
		};
	}
}
