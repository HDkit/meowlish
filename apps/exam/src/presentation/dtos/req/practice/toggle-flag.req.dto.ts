import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class ToggleFlagDto implements exam.ToggleFlagDto {
	@IsString()
	attemptId!: string;

	@IsString()
	questionId!: string;

	@IsString()
	userId!: string;
}
