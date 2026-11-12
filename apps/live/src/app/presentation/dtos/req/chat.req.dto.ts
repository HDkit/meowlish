import { IsString, MaxLength } from 'class-validator';

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export class ChatDto {
	@IsString()
	roomId!: string;

	@IsString()
	@MaxLength(CHAT_MESSAGE_MAX_LENGTH)
	message!: string;
}
