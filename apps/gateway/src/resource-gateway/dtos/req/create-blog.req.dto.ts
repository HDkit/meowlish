import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateBlogDto {
	@IsString()
	@ApiProperty()
	title!: string;

	@IsString()
	@ApiProperty()
	content!: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
