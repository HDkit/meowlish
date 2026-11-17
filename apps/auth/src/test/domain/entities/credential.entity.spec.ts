import { Credential } from '../../../domain/entities/credential.entity';
import { LoginType } from '../../../enums/login-type.enum';
import bcrypt from 'bcrypt';

describe('Credential', () => {
	it('hashSecret hashes without the blocking bcrypt API', async () => {
		const hashSync = jest.spyOn(bcrypt, 'hashSync');
		const hash = await Credential.hashSecret('Pass-word-1!');
		expect(hash).not.toBe('Pass-word-1!');
		await expect(bcrypt.compare('Pass-word-1!', hash)).resolves.toBe(true);
		expect(hashSync).not.toHaveBeenCalled();
		hashSync.mockRestore();
	});

	it('stores the given hash as is', () => {
		const credential = new Credential({
			identifier: 'a@b.c',
			loginType: LoginType.Mail,
			secretHash: '$2b$10$stored',
		});
		expect(credential.secretHash).toBe('$2b$10$stored');
		credential.update({ secretHash: '$2b$10$next' });
		expect(credential.secretHash).toBe('$2b$10$next');
	});

	it('a Google credential has no secret', () => {
		expect(
			new Credential({ identifier: 'g-1', loginType: LoginType.Google }).secretHash,
		).toBeNull();
	});
});
