import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class EndAttemptDto implements exam.EndAttemptDto {
	@IsString()
	attemptId!: string;

	@IsString()
	userId!: string;
}
