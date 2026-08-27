import { auth } from '@server/generated';
import { Transform } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const toArray = (value: unknown) =>
	Array.isArray(value) ? value
	: value ? [value]
	: [];

export class FindIdentitiesDto implements auth.FindIdentitiesDto {
	@IsOptional()
	@IsString()
	usernameOrCredIdentifierOrId?: string;

	@Transform(({ value }) => toArray(value))
	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	hasPerms: string[] = [];

	@Transform(({ value }) => toArray(value))
	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	hasRoles: string[] = [];

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsNumber()
	@IsOptional()
	@IsPositive()
	limit?: number;
}
