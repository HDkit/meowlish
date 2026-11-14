import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsString, Length } from 'class-validator';

export class AddNoteDto implements Omit<exam.AddNoteDto, 'attemptId' | 'questionId' | 'userId'> {
	@IsString()
	@ApiProperty()
	@Length(0, 500)
	note!: string;
}
