import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBlogDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	title?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	content?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
