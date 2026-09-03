import { auth } from '@server/generated';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class FindIdentitiesByPhoneDto implements auth.FindIdentitiesByPhoneDto {
	@IsString()
	phoneNumber!: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	limit?: number;
}
