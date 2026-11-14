import { exam } from '@server/generated';
import { Expose } from 'class-transformer';

export class ExamDetailedManagementInfoDto implements exam.ExamManagementDetailedInfo {
	@Expose()
	createdAt!: Date;

	@Expose()
	createdBy!: string;

	@Expose()
	description?: string;

	@Expose()
	duration!: number;

	@Expose()
	id!: string;

	@Expose()
	slug?: string;

	@Expose()
	sectionIds!: string[];

	@Expose()
	status!: string;

	@Expose()
	tags!: string[];

	@Expose()
	title!: string;

	@Expose()
	updatedAt!: Date;
}
