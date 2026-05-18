import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const toArray = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []);

export class FindIdentitiesDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	usernameOrCredIdentifierOrId?: string;

	@Transform(({ value }) => toArray(value))
	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	hasPerms: string[] = [];

	@Transform(({ value }) => toArray(value))
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
