import { GoalType } from '../../../../enums/goal-type.enum';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsString } from 'class-validator';

export class SetGoalDto implements exam.SetGoalDto {
	@IsString()
	uid!: string;

	@Type(() => Date)
	@IsDate()
	date!: Date;

	// the range and step depend on the type: checked by assertValidGoalTarget in GoalService
	@IsNumber({ allowInfinity: false, allowNaN: false })
	target!: number;

	@IsEnum(GoalType)
	type!: GoalType;
}
