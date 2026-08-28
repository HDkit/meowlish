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
import { CursorPaginationHelper } from '@server/utils';
import { firstValueFrom } from 'rxjs';

type FindIdentitiesByPhoneCursor = {
	lastId?: string;
	direction?: number;
	limit?: number;
};

@QueryHandler(FindIdentitiesByPhoneQuery)
export class FindIdentitiesByPhoneQueryHandler
	implements IQueryHandler<FindIdentitiesByPhoneQuery>, OnModuleInit
{
	private readonly cursorPaginationHelper: CursorPaginationHelper;
	private fileService!: file.FileServiceClient;

	constructor(
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {
		this.cursorPaginationHelper = new CursorPaginationHelper(
			`${process.env.HOST}${process.env.PORT}FindIdentitiesByPhone`,
		);
	}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	async execute(query: FindIdentitiesByPhoneQuery): Promise<FindIdentitiesByPhoneQueryResult> {
		const payload = query.payload;
		const decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<FindIdentitiesByPhoneCursor>(payload.cursor)
			:	undefined;

		const inUsePhone = payload.phoneNumber;
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const identities = await this.identityReadRepository.findIdentitiesByPhone({
			phoneNumber: inUsePhone,
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
			direction: direction,
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

		const encodedNextCursor = this.cursorPaginationHelper.encodeCursor<FindIdentitiesByPhoneCursor>(
			{
				lastId: identities.at(-1)?.id,
				direction: 1,
				limit: inUseLimit,
			},
		);
		const encodedPrevCursor = this.cursorPaginationHelper.encodeCursor<FindIdentitiesByPhoneCursor>(
			{
				lastId: identities.at(0)?.id,
				direction: -1,
				limit: inUseLimit,
			},
		);

		return {
			identities: identities,
			nextCursor: encodedNextCursor,
			prevCursor: encodedPrevCursor,
		};
	}
}
