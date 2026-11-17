import { ChatLogEntryDto } from './chat-log.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class RoomDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiPropertyOptional()
	scheduledLiveUrl?: string;

	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	scheduledDate?: Date;

	@Expose()
	@ApiPropertyOptional({
		description: 'Creator of the room (mods may delete/schedule only their own rooms)',
	})
	createdBy?: string;

	@Expose()
	@Type(() => ChatLogEntryDto)
	@ApiPropertyOptional({ type: () => ChatLogEntryDto, description: 'Newest message, for previews' })
	lastMessage?: ChatLogEntryDto;
}

export class RoomListDto {
	@Expose()
	@Type(() => RoomDto)
	@ApiProperty({ type: () => [RoomDto] })
	rooms!: RoomDto[];

	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;
}
