import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class MoveTagDto implements Omit<exam.MoveTagDto, 'id'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	parentId?: string;
}
