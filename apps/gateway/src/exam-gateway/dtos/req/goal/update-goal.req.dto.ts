import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsString, Max, Min } from 'class-validator';

export class UpdateGoalDto implements Omit<exam.UpdateGoalDto, 'uid'> {
	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	date!: Date;

	// the range and step depend on the type; the exam service checks them (400 otherwise)
	@IsNumber({ allowInfinity: false, allowNaN: false })
	@Max(990)
	@Min(0)
	@ApiProperty({
		type: Number,
		minimum: 0,
		maximum: 990,
		example: 6.5,
		description:
			"Target score in the type's own scale: IELTS 0-9 in steps of 0.5, TOEIC 10-990 in steps of 5, TOEFL 0-120 whole numbers, VSTEP 0-10 in steps of 0.5",
	})
	target!: number;

	@IsIn(['IELTS', 'TOEIC', 'VSTEP', 'TOEFL'])
	@IsString()
	@ApiProperty({ enum: ['IELTS', 'TOEIC', 'VSTEP', 'TOEFL'] })
	type!: string;
}
