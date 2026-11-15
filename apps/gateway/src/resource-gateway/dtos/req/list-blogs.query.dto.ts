import { PageQueryDto } from './page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToStringArray } from '@server/utils';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

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

	@IsOptional()
	@IsString()
	@MaxLength(200)
	@ApiPropertyOptional({ description: 'Posts whose title contains this text (case-insensitive)' })
	title?: string;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'Posts created at or after this moment',
	})
	createdFrom?: Date;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'Posts created at or before this moment',
	})
	createdTo?: Date;
}
