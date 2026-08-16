import {
	type IBadgeReadRepository,
	IBadgeReadRepositoryToken,
} from '../../../domain/repositories/badge.read.repository';
import {
	GetUsersBadgesCursor,
	GetUsersBadgesQuery,
	GetUsersBadgesQueryResult,
} from '../achievement.get-users-badges.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CursorPaginationHelper } from '@server/utils';

@QueryHandler(GetUsersBadgesQuery)
export class GetUsersBadgesQueryHandler implements IQueryHandler<GetUsersBadgesQuery> {
	private readonly cursorPaginationHelper: CursorPaginationHelper;

	constructor(
		@Inject(IBadgeReadRepositoryToken) private readonly badgeReadRepository: IBadgeReadRepository,
	) {
		this.cursorPaginationHelper = new CursorPaginationHelper(
			`${process.env.HOST}${process.env.PORT}GetBadges`,
		);
	}

	async execute(query: GetUsersBadgesQuery): Promise<GetUsersBadgesQueryResult> {
		const payload = query.payload;
		let decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<GetUsersBadgesCursor>(payload.cursor)
			:	undefined;

		// basically invalidate cursor if payload has different values
		if (
			decodedCursor &&
			decodedCursor?.userId &&
			payload.userId &&
			payload.userId !== decodedCursor.userId
		)
			decodedCursor = undefined;
		// cursor.userId has precedence over payload
		const inUseUserId = decodedCursor ? decodedCursor.userId : payload.userId;
		// payload.limit has precedence over cursor
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;

		const badges = await this.badgeReadRepository.getUsersBadges(inUseUserId, {
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
		});
		const encodedCursor = this.cursorPaginationHelper.encodeCursor<GetUsersBadgesCursor>({
			userId: inUseUserId,
			lastId: badges.at(-1)?.id,
			limit: inUseLimit,
		});
		return { badges: badges, cursor: encodedCursor };
	}
}
