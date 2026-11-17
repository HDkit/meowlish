import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreateExamDto implements Omit<exam.CreateExamDto, 'createdBy'> {
	@IsString()
	@ApiProperty()
	description!: string;

	@IsInt()
	@IsPositive()
	@ApiProperty({ type: Number })
	duration!: number;

	@IsString()
	@ApiProperty()
	title!: string;
}
