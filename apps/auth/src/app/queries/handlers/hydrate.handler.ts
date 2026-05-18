import { FILE_CLIENT } from '../../../constants/file';
import { HydratedIdentityReadModel } from '../../../domain/read-models/identity.read-model';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import { HydrateQuery } from '../auth.hydrate.query';
import { Inject, NotFoundException, OnModuleInit } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(HydrateQuery)
export class HydrateQueryHandler implements IQueryHandler<HydrateQuery>, OnModuleInit {
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: HydrateQuery): Promise<HydratedIdentityReadModel> {
		const payload = query.payload;
		const identity = await this.identityReadRepository.hydrate(payload.id);
		if (!identity) throw new NotFoundException('IdentityNotFound');

		if (identity.avatarUrl) {
			try {
				const urlMap = await firstValueFrom(this.fileService.getUrls({ ids: [identity.avatarUrl] }));
				identity.avatarUrl = urlMap.urls[identity.avatarUrl] ?? identity.avatarUrl;
			} catch {
				// Keep raw file ID if file service is unavailable
			}
		}

		return identity;
	}
}
