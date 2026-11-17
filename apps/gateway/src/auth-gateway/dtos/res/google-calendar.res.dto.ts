import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Short-lived access token only; the Google refresh token never reaches the browser. */
export class GoogleCalendarAccessTokenDto {
	@Expose()
	@ApiProperty()
	accessToken!: string;

	@Expose()
	@ApiProperty({ description: 'Expiry as epoch milliseconds', example: 1790000000000 })
	expiresAt!: number;
}

export class GoogleCalendarConnectionDto {
	@Expose()
	@ApiProperty()
	connected!: boolean;

	@Expose()
	@ApiProperty({ description: 'Access token expiry as epoch milliseconds', example: 1790000000000 })
	expiresAt!: number;
}
