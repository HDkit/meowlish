import { IsString } from 'class-validator';

export class ChatDto {
	@IsString()
	roomId!: string;

	@IsString()
	message!: string;
}
