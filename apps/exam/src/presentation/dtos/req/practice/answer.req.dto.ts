import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class AnswerDto implements exam.AnswerDto {
	@IsString()
	attemptId!: string;

	@IsString()
	questionId!: string;

	@IsString()
	answer!: string;

	@IsString()
	userId!: string;
}
