import { auth } from '@server/generated';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FindIdentitiesByPhoneDto implements auth.FindIdentitiesByPhoneDto {
	@IsString()
	phoneNumber!: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsNumber()
	@IsOptional()
	limit?: number;
}
