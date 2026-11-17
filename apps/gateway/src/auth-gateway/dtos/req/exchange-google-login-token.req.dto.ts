import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ExchangeGoogleLoginTokenDto {
	@IsString()
	@ApiProperty({
		description: 'One-time token that /google/callback put on the frontend redirect URL',
	})
	loginToken!: string;
}
