import { live } from '@server/generated';
import { Expose } from 'class-transformer';

export class ChatDto implements live.Chat {
	@Expose()
	createdAt!: Date;

	@Expose()
	id!: string;

	@Expose()
	message!: string;

	@Expose()
	uid!: string;
}
