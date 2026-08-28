import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class ConnectGoogleCalendarDto {
	@IsString()
	@ApiProperty()
	accessToken!: string;

	@IsString()
	@ApiProperty()
	refreshToken!: string;

	@IsNumber()
	@ApiProperty({ type: Number })
	expiresAt!: number;

	@IsString()
	@ApiProperty()
	scopes!: string;
}
