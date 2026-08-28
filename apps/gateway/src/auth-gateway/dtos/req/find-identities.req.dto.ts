import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class FindIdentitiesDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	usernameOrCredIdentifierOrId?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	hasPerms: string[] = [];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	hasRoles: string[] = [];

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsNumber()
	@IsOptional()
	@IsPositive()
	@ApiPropertyOptional({ type: Number })
	limit?: number;
}
