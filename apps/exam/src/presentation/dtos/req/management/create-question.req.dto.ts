import { exam } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto implements exam.CreateQuestionDto {
	@IsInt()
	@IsOptional()
	index?: number;

	@IsString()
	sectionId!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
