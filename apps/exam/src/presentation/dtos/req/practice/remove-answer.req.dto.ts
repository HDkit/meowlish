import { exam } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class RemoveAnswerDto implements exam.RemoveAnswerDto {
	@IsString()
	attemptId!: string;

	@IsString()
	questionId!: string;

	@IsOptional()
	@IsString()
	answer?: string;

	@IsString()
	userId!: string;
}
