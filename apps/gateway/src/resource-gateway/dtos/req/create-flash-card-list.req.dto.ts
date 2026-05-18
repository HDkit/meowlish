import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardListDto {
	@IsString()
	@ApiProperty()
	name!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	description?: string;

	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ type: Boolean })
	isPublic?: boolean;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
