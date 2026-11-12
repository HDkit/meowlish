import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class GetAttemptReviewDto implements exam.GetAttemptReviewDto {
	@IsString()
	attemptId!: string;

	@IsString()
	userId!: string;
}
