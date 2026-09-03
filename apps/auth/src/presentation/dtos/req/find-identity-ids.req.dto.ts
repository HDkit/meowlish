import { auth } from '@server/generated';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class FindIdentityIdsDto implements auth.FindIdentityIdsDto {
	@IsOptional()
	@IsString()
	usernameOrCredIdentifier?: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	limit?: number;
}
