import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class MoveSectionDto implements Omit<
	exam.MoveSectionDto,
	'id' | 'requesterId' | 'privileged'
> {
	@IsInt()
	@IsOptional()
	@ApiPropertyOptional({ type: Number })
	index?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	parentId?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	toRoot?: boolean;
}
