import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToStringArray } from '@server/utils';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class FindIdentitiesDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	usernameOrCredIdentifierOrId?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	// a single query value (`?hasRoles=admin`) arrives as a string
	@ToStringArray()
	hasPerms: string[] = [];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	// a single query value (`?hasRoles=admin`) arrives as a string
	@ToStringArray()
	hasRoles: string[] = [];

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@IsPositive()
	@ApiPropertyOptional({ type: Number })
	limit?: number;
}
