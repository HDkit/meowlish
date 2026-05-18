import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class MinimalExamInfoDto implements exam.Exams_MinimalExamInfo {
	@Expose()
	attemptsCount!: number;

	@Expose()
	description?: string;

	@Expose()
	duration!: number;

	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	tags!: string[];

	@Expose()
	updatedAt!: Date;
}

export class ExamsInfoDto implements exam.Exams {
	@Expose()
	@Type(() => MinimalExamInfoDto)
	exams!: MinimalExamInfoDto[];

	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;
}
