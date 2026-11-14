import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListBlogCommentsQueryDto implements Omit<resource.ListBlogCommentsRequest, 'blogId'> {
	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	@ApiPropertyOptional({ minimum: 1, default: 1 })
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(50)
	@Min(1)
	@ApiPropertyOptional({
		minimum: 1,
		maximum: 50,
		default: 10,
		description: 'Top-level comments per page; each comes with all its replies',
	})
	limit?: number;
}
