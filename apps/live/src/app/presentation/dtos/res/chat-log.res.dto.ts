import { ChatDto } from './chat.dto';
import { live } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class ChatLogDto implements live.GetChatLogResponse {
	@Expose()
	@Type(() => ChatDto)
	chats!: ChatDto[];

	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;
}
