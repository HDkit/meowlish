import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ChatLogEntryDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	uid!: string;

	@Expose()
	@ApiProperty()
	message!: string;

	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	createdAt?: Date;
}

export class ChatLogDto {
	@Expose()
	@Type(() => ChatLogEntryDto)
	@ApiProperty({ type: () => [ChatLogEntryDto] })
	chats!: ChatLogEntryDto[];

	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;
}
