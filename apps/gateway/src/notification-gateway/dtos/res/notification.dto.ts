import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class NotificationDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	recipientId!: string;

	@Expose()
	@ApiProperty()
	type!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty()
	message!: string;

	@Expose()
	@ApiPropertyOptional()
	data?: string;

	@Expose()
	@ApiProperty({ type: Boolean })
	isRead!: boolean;

	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	readAt?: Date;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: Date;
}

export class NotificationListDto {
	@Expose()
	@Type(() => NotificationDto)
	@ApiProperty({ type: () => [NotificationDto] })
	notifications!: NotificationDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;

	@Expose()
	@ApiProperty({ type: Number })
	unreadCount!: number;
}
