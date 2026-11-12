import {
	type IIdentityReadRepository,
	IIdentityReadRepositoryToken,
} from '../../../domain/repositories/identity.read.repository';
import {
	FindIdentityIdsCursor,
	FindIdentityIdsQuery,
	FindIdentityIdsQueryResult,
} from '../auth.find-identity-ids.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CursorPaginationFactory, CursorPaginationHelper } from '@server/utils';

@QueryHandler(FindIdentityIdsQuery)
export class FindIdentityIdsQueryHandler implements IQueryHandler<FindIdentityIdsQuery> {
	private readonly cursorPaginationHelper: CursorPaginationHelper;

	constructor(
		cursorPaginationFactory: CursorPaginationFactory,
		@Inject(IIdentityReadRepositoryToken)
		private readonly identityReadRepository: IIdentityReadRepository,
	) {
		this.cursorPaginationHelper = cursorPaginationFactory.create('FindIdentityIds');
	}

	async execute(query: FindIdentityIdsQuery): Promise<FindIdentityIdsQueryResult> {
		const payload = query.payload;
		const decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<FindIdentityIdsCursor>(payload.cursor)
			:	undefined;

		const inUseIdentifier = decodedCursor?.usernameOrCredential ?? payload.usernameOrCredential;
		// A request may narrow a cursor to usernames, never widen it.
		const usernameOnly = !!(payload.usernameOnly || decodedCursor?.usernameOnly);
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const identities = await this.identityReadRepository.findIdentityIds({
			usernameOrCredentialIdentifier: inUseIdentifier,
			usernameOnly: usernameOnly,
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
			direction: direction,
		});

		const encodedNextCursor = this.cursorPaginationHelper.encodeCursor<FindIdentityIdsCursor>({
			usernameOrCredential: inUseIdentifier,
			usernameOnly: usernameOnly,
			lastId: identities.at(-1),
			direction: 1,
			limit: inUseLimit,
		});
		const encodedPrevCursor = this.cursorPaginationHelper.encodeCursor<FindIdentityIdsCursor>({
			usernameOrCredential: inUseIdentifier,
			usernameOnly: usernameOnly,
			lastId: identities.at(0),
			direction: -1,
			limit: inUseLimit,
		});

		return { ids: identities, nextCursor: encodedNextCursor, prevCursor: encodedPrevCursor };
	}
}
