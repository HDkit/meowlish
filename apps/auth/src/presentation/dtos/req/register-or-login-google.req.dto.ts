import { auth } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class RegisterOrLoginGoogleDto implements auth.RegisterOrLoginGoogleDto {
	@IsString()
	identifier!: string;

	@IsString()
	username!: string;

	@IsOptional()
	@IsString()
	fullName?: string;

	@IsOptional()
	@IsString()
	email?: string;
}
