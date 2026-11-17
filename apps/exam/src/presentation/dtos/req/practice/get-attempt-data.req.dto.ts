import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class GetAttemptDataDto implements exam.GetAttemptSavedDataDto {
	@IsString()
	attemptId!: string;

	@IsString()
	userId!: string;
}
