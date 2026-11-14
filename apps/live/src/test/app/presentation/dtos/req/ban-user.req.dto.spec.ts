import { BanUserDto } from '../../../../../app/presentation/dtos/req/ban-user.req.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const ban = { roomId: 'r1', uid: 'u1', requesterId: 'mod-1', privileged: false };

describe('BanUserDto', () => {
	it('accepts a ban without a reason (the field is optional in the proto)', async () => {
		expect(await validate(plainToInstance(BanUserDto, ban))).toHaveLength(0);
	});

	it('still rejects a reason that is not a string', async () => {
		const errors = await validate(plainToInstance(BanUserDto, { ...ban, reason: 42 }));
		expect(errors[0].constraints).toHaveProperty('isString');
	});
});
