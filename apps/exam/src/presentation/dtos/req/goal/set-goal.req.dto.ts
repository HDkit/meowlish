import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class SetGoalDto implements exam.SetGoalDto {
	@IsString()
	uid!: string;

	@Type(() => Date)
	@IsDate()
	date!: Date;

	// the column is an integer: half bands such as IELTS 6.5 aren't supported yet
	@IsInt()
	@Max(990)
	@Min(0)
	target!: number;

	@IsIn(['IELTS', 'TOEIC', 'VSTEP', 'TOEFL'])
	@IsString()
	type!: string;
}
