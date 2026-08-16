import { FILE_CLIENT } from '../../../constants/file';
import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import {
	FindIdentitiesCursor,
	FindIdentitiesQuery,
	FindIdentitiesQueryResult,
} from '../auth.find-identities.query';
import { Inject, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { CursorPaginationHelper } from '@server/utils';
import { firstValueFrom } from 'rxjs';

@QueryHandler(FindIdentitiesQuery)
export class FindIdentitiesQueryHandler
	implements IQueryHandler<FindIdentitiesQuery>, OnModuleInit
{
	private readonly cursorPaginationHelper: CursorPaginationHelper;
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {
		this.cursorPaginationHelper = new CursorPaginationHelper(
			`${process.env.HOST}${process.env.PORT}FindIdentities`,
		);
	}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: FindIdentitiesQuery): Promise<FindIdentitiesQueryResult> {
		const payload = query.payload;
		const decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<FindIdentitiesCursor>(payload.cursor)
			:	undefined;

		const inUseIdentifier =
			decodedCursor?.usernameOrCredentialOrId ?? payload.usernameOrCredentialOrId;
		const inUseHasRoles = decodedCursor?.hasRoles ?? payload.hasRoles;
		const inUseHasPerms = decodedCursor?.hasPerms ?? payload.hasPerms;
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;

		const identities = await this.identityReadRepository.findIdentities({
			usernameOrCredentialIdentifierOrId: inUseIdentifier,
			hasRoles: inUseHasRoles,
			hasPerms: inUseHasPerms,
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
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

		const encodedCursor = this.cursorPaginationHelper.encodeCursor<FindIdentitiesCursor>({
			usernameOrCredentialOrId: inUseIdentifier,
			hasRoles: inUseHasRoles,
			hasPerms: inUseHasPerms,
			lastId: identities.at(-1)?.id,
			limit: inUseLimit,
		});

		return {
			identities: identities,
			cursor: encodedCursor,
		};
	}
}
