import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { notification } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto implements notification.CreateNotificationRequest {
	@IsString()
	@ApiProperty()
	recipientId!: string;

	@IsString()
	@ApiProperty()
	type!: string;

	@IsString()
	@ApiProperty()
	title!: string;

	@IsString()
	@ApiProperty()
	message!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	data?: string;
}
