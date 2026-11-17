import { auth } from '@server/generated';
import { IsArray, IsBoolean, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class FindIdentitiesDto implements auth.FindIdentitiesDto {
	@IsOptional()
	@IsString()
	usernameOrCredIdentifierOrId?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	hasPerms: string[] = [];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	hasRoles: string[] = [];

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	limit?: number;

	@IsBoolean()
	@IsOptional()
	usernameOnly?: boolean;
}
