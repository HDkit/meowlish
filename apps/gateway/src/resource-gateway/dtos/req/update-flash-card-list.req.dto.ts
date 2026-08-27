import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardListDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	name?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	description?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	isPublic?: boolean;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
