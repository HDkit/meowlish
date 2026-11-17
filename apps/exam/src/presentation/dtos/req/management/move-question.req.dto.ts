import { exam } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class MoveQuestionDto implements exam.MoveQuestionDto {
	@IsString()
	id!: string;

	@IsInt()
	@IsOptional()
	index?: number;

	@IsOptional()
	@IsString()
	sectionId?: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
