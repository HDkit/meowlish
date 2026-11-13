import { Identity } from '../../../domain/entities/identity.entity';
import { AddGoogleCredCommand } from '../auth.add-google-cred.command';
import { AddGoogleCredCommandHandler } from './add-google-cred.handler';
import { ConflictException } from '@nestjs/common';

const setup = (owner: { identityId: string } | null) => {
	const identity = new Identity({ id: 'i1', username: 'u' });
	const repo = {
		findOneById: jest.fn().mockResolvedValue(identity),
		findOneCredential: jest.fn().mockResolvedValue(owner),
		save: jest.fn(),
	};
	const handler = new AddGoogleCredCommandHandler(repo as never, {} as never, {} as never);
	return { identity: identity, repo: repo, handler: handler };
};

const cmd = () => new AddGoogleCredCommand({ identityId: 'i1', identifier: 'g-1' });

describe('AddGoogleCredCommandHandler', () => {
	it('links a Google account nobody uses', async () => {
		const { identity, repo, handler } = setup(null);
		await handler.execute(cmd());
		expect(identity.credentials).toHaveLength(1);
		expect(repo.save).toHaveBeenCalledWith(identity);
	});

	it("refuses another account's Google account with a clear 409", async () => {
		const { repo, handler } = setup({ identityId: 'someone-else' });
		await expect(handler.execute(cmd())).rejects.toThrow(
			new ConflictException('This Google account is linked to another account'),
		);
		expect(repo.save).not.toHaveBeenCalled();
	});
});
