import { exam } from '@server/generated';
import { IsString, Length } from 'class-validator';

export class AddNoteDto implements exam.AddNoteDto {
	@IsString()
	attemptId!: string;

	@IsString()
	questionId!: string;

	@IsString()
	@Length(0, 500)
	note!: string;

	@IsString()
	userId!: string;
}
