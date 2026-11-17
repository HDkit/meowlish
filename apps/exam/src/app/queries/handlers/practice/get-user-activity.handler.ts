import {
	type ActivityRange,
	UserActivity,
	buildUserActivity,
	isDayKey,
	lastDays,
	rangeLength,
} from '../../../../domain/read-models/practice/user-activity.read-model';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../../../domain/repositories/practice.read.repository';
import { GetUserActivityQuery } from '../../practice/exam.get-user-activity.query';
import { BadRequestException, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

export const defaultActivityDays = 182;
export const maxActivityDays = 371;

@QueryHandler(GetUserActivityQuery)
export class GetUserActivityQueryHandler implements IQueryHandler<GetUserActivityQuery> {
	constructor(
		@Inject(IPracticeReadRepositoryToken)
		private readonly practiceReadRepository: IPracticeReadRepository,
	) {}

	async execute(query: GetUserActivityQuery): Promise<UserActivity> {
		const { userId } = query.payload;
		const now = new Date();
		const range = resolveRange(query.payload, now);
		const rows = await this.practiceReadRepository.getUserActivityDays(userId);
		return buildUserActivity(rows, now, range);
	}
}

/** `from`/`to` when sent (checked), else the last `days` days (clamped), else the default. */
function resolveRange(
	payload: { days?: number; from?: string; to?: string },
	now: Date,
): ActivityRange {
	// proto3 wrappers can arrive as '' rather than absent
	const from = payload.from || undefined;
	const to = payload.to || undefined;
	if (from === undefined && to === undefined) {
		const days = Math.min(
			Math.max(Math.trunc(payload.days ?? defaultActivityDays), 1),
			maxActivityDays,
		);
		return lastDays(now, days);
	}
	if (payload.days !== undefined) {
		throw new BadRequestException('Send either days or from/to, not both');
	}
	if (from === undefined || to === undefined) {
		throw new BadRequestException('from and to must be sent together');
	}
	if (!isDayKey(from) || !isDayKey(to)) {
		throw new BadRequestException('from and to must be days written YYYY-MM-DD');
	}
	if (from > to) throw new BadRequestException('from must not be after to');
	const range = { from: from, to: to };
	if (rangeLength(range) > maxActivityDays) {
		throw new BadRequestException(`The range must be at most ${maxActivityDays} days`);
	}
	return range;
}
