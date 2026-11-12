import { CHAT_MESSAGE_MAX_LENGTH, ChatDto } from './chat.req.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const check = (message: string) =>
	validate(plainToInstance(ChatDto, { roomId: 'r', message: message }));

describe('ChatDto', () => {
	it('accepts a message of exactly the max length', async () => {
		expect(await check('a'.repeat(CHAT_MESSAGE_MAX_LENGTH))).toHaveLength(0);
	});
	it('rejects a message over 2000 characters', async () => {
		const errors = await check('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1));
		expect(errors[0].constraints).toHaveProperty('maxLength');
	});
});
