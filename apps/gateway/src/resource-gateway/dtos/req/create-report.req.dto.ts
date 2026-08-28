import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
	@IsString()
	@ApiProperty()
	type!: string;

	@IsString()
	@ApiProperty()
	title!: string;

	@IsString()
	@ApiProperty()
	description!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	targetType?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	targetId?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	fileIds?: string[];
}
