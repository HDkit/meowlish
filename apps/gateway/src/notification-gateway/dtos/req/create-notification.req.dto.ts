import { notification } from '@server/generated';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto implements notification.CreateNotificationRequest {
	@IsString()
	@ApiProperty()
	recipientId!: string | undefined;

	@IsString()
	@ApiProperty()
	type!: string | undefined;

	@IsString()
	@ApiProperty()
	title!: string | undefined;

	@IsString()
	@ApiProperty()
	message!: string | undefined;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	data?: string | undefined;
}
