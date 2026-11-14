import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class RemoveAnswerDto implements Omit<
	exam.RemoveAnswerDto,
	'attemptId' | 'questionId' | 'userId'
> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	answer?: string;
}
