import { auth } from '@server/generated';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ValidateAccessDto implements auth.ValidateAccessDto {
	@IsNotEmpty()
	@IsString()
	identityId!: string;

	@IsNumber()
	iat!: number;

	@IsNumber()
	@IsOptional()
	iatMs!: number | undefined;
}
