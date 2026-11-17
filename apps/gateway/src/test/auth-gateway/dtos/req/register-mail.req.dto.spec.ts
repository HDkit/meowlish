import { RegisterMailDto } from '../../../../auth-gateway/dtos/req/register-mail.req.dto';
import { UpdateIdentityDto } from '../../../../auth-gateway/dtos/req/update-identity.req.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const register = (username: string) =>
	validate(
		plainToInstance(RegisterMailDto, {
			mail: 'a@b.cd',
			password: 'Right-Pass-1!',
			username: username,
		}),
	);

describe('gateway RegisterMailDto.username', () => {
	it.each(['minh.nguyen', 'van_a-2', 'x'.repeat(30)])('accepts %p', async username => {
		expect(await register(username)).toHaveLength(0);
	});

	it.each(['Van A', 'ab', 'x'.repeat(31), 'nguyễn', 'аdmin', 'a\tb'])(
		'refuses %p',
		async username => {
			const errors = await register(username);
			expect(errors.map(e => e.property)).toEqual(['username']);
			expect(Object.values(errors[0].constraints ?? {})).toEqual([
				'username must be 3-30 characters of lowercase letters, digits, ".", "_" or "-"',
			]);
		},
	);
});

describe('gateway UpdateIdentityDto.username', () => {
	it('lets an unchanged legacy username through (auth checks only a change)', async () => {
		const dto = plainToInstance(UpdateIdentityDto, { username: 'Nguyễn Văn A' });
		expect(await validate(dto)).toHaveLength(0);
	});
});
