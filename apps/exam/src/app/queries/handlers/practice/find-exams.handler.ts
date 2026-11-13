import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import {
	FindExamsCursor,
	FindExamsQuery,
	FindExamsQueryResult,
} from '../../practice/exam.find-exams.query';
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CursorPaginationFactory, CursorPaginationHelper } from '@server/utils';

@QueryHandler(FindExamsQuery)
export class FindExamsHandler implements IQueryHandler<FindExamsQuery> {
	private readonly cursorPaginationHelper: CursorPaginationHelper;

	constructor(
		cursorPaginationFactory: CursorPaginationFactory,
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {
		this.cursorPaginationHelper = cursorPaginationFactory.create('FindExams');
	}

	async execute(query: FindExamsQuery): Promise<FindExamsQueryResult> {
		const payload = query.payload;
		if (payload.page !== undefined) {
			// page mode: numbered pages over the catalogue, with a total for the page links
			const limit = payload.limit ?? 10;
			const [exams, totalCount] = await Promise.all([
				this.practiceReadRepository.findExams({
					filter: payload.filter,
					sortBy: payload.sortBy,
					limit: limit,
					page: payload.page,
				}),
				this.practiceReadRepository.countExams(payload.filter),
			]);
			return { exams: exams, nextCursor: '', prevCursor: '', totalCount: totalCount };
		}
		const decodedCursor =
			payload.cursor ?
				this.cursorPaginationHelper.decodeCursor<FindExamsCursor>(payload.cursor)
			:	undefined;

		// cursor.filter has precedence
		const inUseFilter = decodedCursor ? decodedCursor.filter : payload.filter;
		// cursor.sortBy has precedence
		const inUseSortBy = decodedCursor ? decodedCursor.sortBy : payload.sortBy;
		// payload.limit has precedence
		const inUseLimit = payload.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const exams = await this.practiceReadRepository.findExams({
			filter: inUseFilter,
			sortBy: inUseSortBy,
			lastCursor:
				decodedCursor?.lastCursor ?
					{
						...decodedCursor.lastCursor,
						updatedAt:
							decodedCursor.lastCursor.updatedAt ?
								new Date(decodedCursor.lastCursor.updatedAt)
							:	undefined,
					}
				:	undefined,
			limit: inUseLimit,
			direction: direction,
		});

		const lastExamItem = exams.at(-1);
		const firstExamItem = exams.at(0);

		const encodeCursor = (item: typeof lastExamItem, dir: number) =>
			this.cursorPaginationHelper.encodeCursor<FindExamsCursor>({
				filter: inUseFilter,
				sortBy: inUseSortBy,
				lastCursor:
					item ?
						{
							id: item.id,
							attemptsCount: inUseSortBy?.key === 'attemptsCount' ? item.attemptsCount : undefined,
							updatedAt: inUseSortBy?.key === 'updatedAt' ? item.updatedAt.getTime() : undefined,
						}
					:	undefined,
				direction: dir,
				limit: inUseLimit,
			});

		return {
			exams: exams,
			nextCursor: encodeCursor(lastExamItem, 1),
			prevCursor: encodeCursor(firstExamItem, -1),
		};
	}
}
