import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsInt, IsOptional } from 'class-validator';

export class CreateSectionDto implements Omit<
	exam.CreateSectionDto,
	'sectionId' | 'examId' | 'requesterId' | 'privileged'
> {
	@IsInt()
	@IsOptional()
	@ApiPropertyOptional({ type: Number })
	index?: number;
}
