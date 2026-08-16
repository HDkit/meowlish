import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import {
	GetUsersAttemptHistoryCursor,
	GetUsersAttemptHistoryQuery,
	GetUsersAttemptHistoryQueryResult,
} from '../../practice/exam.get-users-attempt-history.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CursorPaginationHelper } from '@server/utils';

@QueryHandler(GetUsersAttemptHistoryQuery)
export class GetUsersAttemptHistoryHandler implements IQueryHandler<GetUsersAttemptHistoryQuery> {
	private readonly cursorPaginationHelper: CursorPaginationHelper;

	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {
		this.cursorPaginationHelper = new CursorPaginationHelper(
			`${process.env.HOST}${process.env.PORT}GetUsersAttemptHistory`,
		);
	}

	async execute(query: GetUsersAttemptHistoryQuery): Promise<GetUsersAttemptHistoryQueryResult> {
		const payload = query.payload;
		let decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<GetUsersAttemptHistoryCursor>(payload.cursor)
			:	undefined;

		// Invalidate cursor if payload and cursor uid is different
		if (decodedCursor && decodedCursor?.uid && payload.uid && payload.uid !== decodedCursor.uid)
			decodedCursor = undefined;
		// cursor.uid has precedence
		const inUseUserId = decodedCursor ? decodedCursor.uid : payload.uid;
		// cursor.examId has precedence
		const inUseExamId = decodedCursor ? decodedCursor.examId : payload.examId;
		// payload.limit has precedence
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;
		// cursor.sortBy has precedence
		const inUseSortBy = decodedCursor ? decodedCursor.sortBy : payload.sortBy;

		const attempts = await this.practiceReadRepository.getUsersAttemptHistory(inUseUserId, {
			examId: inUseExamId,
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
			sortBy: inUseSortBy,
		});

		const encodedCursor = this.cursorPaginationHelper.encodeCursor<GetUsersAttemptHistoryCursor>({
			lastId: attempts.at(-1)?.id,
			uid: inUseUserId,
			examId: inUseExamId,
			limit: inUseLimit,
			sortBy: inUseSortBy,
		});

		return { attempts: attempts, cursor: encodedCursor };
	}
}
