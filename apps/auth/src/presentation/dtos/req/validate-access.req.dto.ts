import { auth } from '@server/generated';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ValidateAccessDto implements auth.ValidateAccessDto {
	@IsNotEmpty()
	@IsString()
	identityId!: string;

	@IsNumber()
	iat!: number;
}
