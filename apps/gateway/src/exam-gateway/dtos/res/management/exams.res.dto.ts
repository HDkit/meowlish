import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class ExamDto {
	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: Date;

	@Expose()
	@ApiProperty()
	createdBy!: string;

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	status!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;
}

export class ExamsManagementInfoDto {
	@Expose()
	@Type(() => ExamDto)
	@ApiProperty({ type: () => [ExamDto] })
	exams!: ExamDto[];

	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;
}
