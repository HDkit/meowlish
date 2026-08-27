import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BanUserFromRoomDto {
	@IsString()
	@ApiProperty()
	uid!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	reason?: string;
}
