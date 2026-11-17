import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class MoveQuestionDto implements Omit<
	exam.MoveQuestionDto,
	'id' | 'requesterId' | 'privileged'
> {
	@IsInt()
	@IsOptional()
	@ApiPropertyOptional({ type: Number })
	index?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	sectionId?: string;
}
