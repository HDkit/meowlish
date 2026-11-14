import { auth } from '@server/generated';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max } from 'class-validator';

export class FindIdentitiesByPhoneDto implements auth.FindIdentitiesByPhoneDto {
	// an empty string would match every identity
	@IsNotEmpty()
	@IsString()
	phoneNumber!: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(100)
	limit?: number;
}
