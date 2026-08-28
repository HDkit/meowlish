import { FILE_CLIENT } from '../../../constants/file';
import { HydratedIdentityReadModel } from '../../../domain/read-models/identity.read-model';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import { HydrateManyQuery } from '../auth.hydrate-many.query';
import { Inject, OnModuleInit } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(HydrateManyQuery)
export class HydrateManyQueryHandler implements IQueryHandler<HydrateManyQuery>, OnModuleInit {
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: HydrateManyQuery): Promise<HydratedIdentityReadModel[]> {
		const payload = query.payload;
		const identities = await this.identityReadRepository.hydrateMany(payload.ids);

		const avatarIds = identities.map(i => i.avatarUrl).filter((id): id is string => !!id);
		if (avatarIds.length > 0) {
			try {
				const urlMap = await firstValueFrom(this.fileService.getUrls({ ids: avatarIds }));
				identities.forEach(i => {
					if (i.avatarUrl) i.avatarUrl = urlMap.urls[i.avatarUrl] ?? i.avatarUrl;
				});
			} catch {
				// Keep raw file IDs if file service is unavailable
			}
		}

		return identities;
	}
}
