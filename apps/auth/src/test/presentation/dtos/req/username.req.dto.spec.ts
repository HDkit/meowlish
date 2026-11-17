import { RegisterMailDto } from '../../../../presentation/dtos/req/register-mail.req.dto';
import { UpdateIdentityDto } from '../../../../presentation/dtos/req/update-identity.req.dto';
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

describe('RegisterMailDto.username', () => {
	it.each(['minh.nguyen', 'van_a-2', 'abc'])('accepts %p', async username => {
		expect(await register(username)).toHaveLength(0);
	});

	it.each(['Van A', 'ab', 'x'.repeat(31), 'nguyễn', 'аdmin', 'a\u0000b', ' '])(
		'refuses %p',
		async username => {
			const errors = await register(username);
			expect(errors.map(e => e.property)).toEqual(['username']);
		},
	);
});

describe('UpdateIdentityDto.username', () => {
	// the charset applies only to a change, which the DTO can't see; the handler checks it
	it('accepts an existing nonconforming username (checked by the handler)', async () => {
		const dto = plainToInstance(UpdateIdentityDto, { identityId: 'i1', username: 'Nguyễn Văn A' });
		expect(await validate(dto)).toHaveLength(0);
	});

	it('still refuses a blank username', async () => {
		const dto = plainToInstance(UpdateIdentityDto, { identityId: 'i1', username: '   ' });
		expect((await validate(dto)).map(e => e.property)).toEqual(['username']);
	});
});
