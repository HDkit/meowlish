import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListBlogsReqDto implements resource.ListBlogsRequest {
	@IsOptional()
	@IsString()
	authorId?: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	limit?: number;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	createdFrom?: Date;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	createdTo?: Date;
}
