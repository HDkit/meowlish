import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class AnswerDto implements Omit<exam.AnswerDto, 'attemptId' | 'questionId' | 'userId'> {
	@IsString()
	@ApiProperty()
	answer!: string;
}
