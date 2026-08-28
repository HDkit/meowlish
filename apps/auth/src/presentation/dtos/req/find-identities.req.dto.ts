import { auth } from '@server/generated';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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

	@IsNumber()
	@IsOptional()
	@IsPositive()
	limit?: number;
}
