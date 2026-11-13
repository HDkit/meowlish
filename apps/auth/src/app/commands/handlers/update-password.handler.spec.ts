import { Credential } from '../../../domain/entities/credential.entity';
import { Identity } from '../../../domain/entities/identity.entity';
import { LoginType } from '../../../enums/login-type.enum';
import { UpdatePasswordCommand } from '../auth.update-password.command';
import { UpdatePasswordCommandHandler } from './update-password.handler';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';

const setup = () => {
	const credential = { id: 'c1', secretHash: bcrypt.hashSync('Old-Pass-1!', 4) };
	const identity = { credentials: [credential], updateCredential: jest.fn() };
	const repo = {
		findOneById: jest.fn().mockResolvedValue(identity),
		save: jest.fn(),
	};
	const tokens = { revokeUser: jest.fn() };
	const handler = new UpdatePasswordCommandHandler(repo as never, tokens as never);
	return { handler: handler, repo: repo, identity: identity, tokens: tokens };
};

const cmd = (currentPassword: string) =>
	new UpdatePasswordCommand({
		identityId: 'i1',
		id: 'c1',
		currentPassword: currentPassword,
		password: 'New-Pass-2!',
	});

describe('UpdatePasswordCommandHandler', () => {
	it('wrong current password is 401 and keeps sessions', async () => {
		const { handler, repo, identity, tokens } = setup();
		await expect(handler.execute(cmd('nope'))).rejects.toBeInstanceOf(UnauthorizedException);
		expect(identity.updateCredential).not.toHaveBeenCalled();
		expect(repo.save).not.toHaveBeenCalled();
		expect(tokens.revokeUser).not.toHaveBeenCalled();
	});

	it('the demo account is 403 even with the correct current password', async () => {
		const hash = bcrypt.hashSync('Demo@12345', 4);
		const identity = new Identity({
			id: 'i1',
			username: 'demo',
			isDemo: true,
			credentials: [
				new Credential({
					id: 'c1',
					identifier: 'demo@lingriser.test',
					loginType: LoginType.Mail,
					secretHash: hash,
					isHashed: true,
				}),
			],
		});
		const repo = { findOneById: jest.fn().mockResolvedValue(identity), save: jest.fn() };
		const tokens = { revokeUser: jest.fn() };
		const handler = new UpdatePasswordCommandHandler(repo as never, tokens as never);
		await expect(handler.execute(cmd('Demo@12345'))).rejects.toBeInstanceOf(ForbiddenException);
		expect(identity.credentials[0].secretHash).toBe(hash);
		expect(repo.save).not.toHaveBeenCalled();
		expect(tokens.revokeUser).not.toHaveBeenCalled();
	});

	it('correct current password updates and revokes sessions', async () => {
		const { handler, repo, identity, tokens } = setup();
		await handler.execute(cmd('Old-Pass-1!'));
		expect(identity.updateCredential).toHaveBeenCalledWith('c1', { secretHash: 'New-Pass-2!' });
		expect(repo.save).toHaveBeenCalledWith(identity);
		expect(tokens.revokeUser).toHaveBeenCalledWith('i1');
	});
});
