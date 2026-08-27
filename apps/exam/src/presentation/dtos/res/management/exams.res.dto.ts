import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class ExamDto implements exam.FoundExamsForManagement_ExamManagementMinimalInfo {
	@Expose()
	createdAt!: Date;

	@Expose()
	createdBy!: string;

	@Expose()
	id!: string;

	@Expose()
	status!: string;

	@Expose()
	title!: string;

	@Expose()
	updatedAt!: Date;
}

export class ExamsManagementInfoDto implements exam.FoundExamsForManagement {
	@Expose()
	@Type(() => ExamDto)
	exams!: ExamDto[];

	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;
}
