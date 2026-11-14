import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class ExamDetailDto implements exam.DetailedExamInfo {
	@Expose()
	attemptsCount!: number;

	@Expose()
	description?: string;

	@Expose()
	duration!: number;

	@Expose()
	id!: string;

	@Expose()
	slug?: string;

	@Expose()
	name!: string;

	@Expose()
	@Type(() => SectionDto)
	sections!: SectionDto[];

	@Expose()
	tags!: string[];

	@Expose()
	updatedAt!: Date;
}

class SectionDto implements exam.DetailedExamInfo_DetailedExamSection {
	@Expose()
	id!: string;

	@Expose()
	name?: string;

	@Expose()
	questionsCount!: number;

	@Expose()
	tags!: string[];
}
