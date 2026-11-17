import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsInt, IsOptional } from 'class-validator';

export class CreateQuestionDto implements Omit<
	exam.CreateQuestionDto,
	'sectionId' | 'requesterId' | 'privileged'
> {
	@IsInt()
	@IsOptional()
	@ApiPropertyOptional({ type: Number })
	index?: number;
}
