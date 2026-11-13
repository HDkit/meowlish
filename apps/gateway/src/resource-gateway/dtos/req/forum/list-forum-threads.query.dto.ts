import { PageQueryDto } from '../page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListForumThreadsQueryDto
	extends PageQueryDto
	implements Omit<resource.ListForumThreadsRequest, 'categoryId'>
{
	@IsOptional()
	@IsString()
	@MaxLength(200)
	@ApiPropertyOptional({ description: 'Threads whose title contains this text (case-insensitive)' })
	search?: string;
}
