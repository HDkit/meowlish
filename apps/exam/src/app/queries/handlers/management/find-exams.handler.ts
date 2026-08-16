import {
	type IManagementReadRepository,
	IManagementReadRepositoryToken,
} from '../../../../domain/repositories/management.read.repository';
import {
	FindExamsForManagementCursor,
	FindExamsForManagementQuery,
	FindExamsForManagementQueryResult,
} from '../../management/exam.find-exams.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CursorPaginationHelper } from '@server/utils';

@QueryHandler(FindExamsForManagementQuery)
export class FindExamsForManagementHandler implements IQueryHandler<FindExamsForManagementQuery> {
	private readonly cursorPaginationHelper: CursorPaginationHelper;

	constructor(
		@Inject(IManagementReadRepositoryToken)
		private readonly managementReadRepository: IManagementReadRepository,
	) {
		this.cursorPaginationHelper = new CursorPaginationHelper(
			`${process.env.HOST}${process.env.PORT}FindExamsManagement`,
		);
	}

	async execute(query: FindExamsForManagementQuery): Promise<FindExamsForManagementQueryResult> {
		const payload = query.payload;
		const decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<FindExamsForManagementCursor>(payload.cursor)
			:	undefined;
		if (decodedCursor?.filter) {
			if (decodedCursor.filter.createdTimeRange) {
				const range = decodedCursor.filter.createdTimeRange;
				decodedCursor.filter.createdTimeRange = {
					from: new Date(range.from),
					to: new Date(range.to),
				};
			}
			if (decodedCursor.filter.updatedTimeRange) {
				const range = decodedCursor.filter.updatedTimeRange;
				decodedCursor.filter.updatedTimeRange = {
					from: new Date(range.from),
					to: new Date(range.to),
				};
			}
		}

		// cursor.filter has precedence
		const inUseFilter = decodedCursor ? decodedCursor.filter : payload.filter;
		// cursor.sortBy has precedence
		const inUseSortBy = decodedCursor ? decodedCursor.sortBy : payload.sortBy;
		// payload.limit has precedence
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;

		const exams = await this.managementReadRepository.findExams({
			filter: inUseFilter,
			sortBy: inUseSortBy,
			lastId: decodedCursor?.lastId,
			limit: inUseLimit,
		});

		const encodedCursor = this.cursorPaginationHelper.encodeCursor<FindExamsForManagementCursor>({
			filter: inUseFilter,
			sortBy: inUseSortBy,
			lastId: exams.at(-1)?.id,
			limit: inUseLimit,
		});

		return { exams: exams, cursor: encodedCursor };
	}
}
