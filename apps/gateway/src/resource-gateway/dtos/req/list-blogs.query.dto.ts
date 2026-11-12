import { PageQueryDto, ToStringArray } from './page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ListBlogsQueryDto extends PageQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	authorId?: string;

	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	@ToStringArray()
	tags: string[] = [];
}
