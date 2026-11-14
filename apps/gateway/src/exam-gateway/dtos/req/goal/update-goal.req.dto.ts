import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class UpdateGoalDto implements Omit<exam.UpdateGoalDto, 'uid'> {
	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	date!: Date;

	// stored as an integer (and sent as int32): half bands such as IELTS 6.5 aren't supported yet
	@IsInt()
	@Max(990)
	@Min(0)
	@ApiProperty({
		type: Number,
		minimum: 0,
		maximum: 990,
		description: 'Whole-number target score (e.g. IELTS 7, TOEIC 750)',
	})
	target!: number;

	@IsIn(['IELTS', 'TOEIC', 'VSTEP', 'TOEFL'])
	@IsString()
	@ApiProperty({ enum: ['IELTS', 'TOEIC', 'VSTEP', 'TOEFL'] })
	type!: string;
}
