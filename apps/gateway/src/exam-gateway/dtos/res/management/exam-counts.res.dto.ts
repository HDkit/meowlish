import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ExamCountsDto {
	@Expose()
	@ApiProperty()
	total!: number;

	@Expose()
	@ApiProperty()
	approved!: number;

	@Expose()
	@ApiProperty()
	pending!: number;

	@Expose()
	@ApiProperty()
	rejected!: number;
}
