import {
	UpdateIdentityCommand,
	UpdateIdentityCommandPayload,
} from '../../../../app/commands/auth.update-identity.command';
import { UpdateIdentityCommandHandler } from '../../../../app/commands/handlers/update-identity.handler';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { ForbiddenException } from '@nestjs/common';

// execute() is @Transactional(); register the static host it looks up, backed by a no-op adapter.
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const setup = (currentAvatar: string | null = null) => {
	const identity = {
		avatarFileId: currentAvatar,
		updateDetails: jest.fn(),
		getUncommittedEvents: () => [],
	};
	const repo = { findOneById: jest.fn().mockResolvedValue(identity), save: jest.fn() };
	const publisher = { publish: jest.fn() };
	const files = { assertOwnedBy: jest.fn().mockResolvedValue(undefined) };
	const handler = new UpdateIdentityCommandHandler(
		repo as never,
		publisher as never,
		files as never,
	);
	return { handler: handler, repo: repo, identity: identity, files: files };
};

const cmd = (options: Partial<ConstructorParameters<typeof UpdateIdentityCommandPayload>[0]>) =>
	new UpdateIdentityCommand(new UpdateIdentityCommandPayload({ identityId: 'me', ...options }));

describe('UpdateIdentityCommandHandler avatar ownership', () => {
	it("setting an avatar to someone else's file is 403", async () => {
		const { handler, repo, files } = setup();
		files.assertOwnedBy.mockRejectedValue(new ForbiddenException('foreign'));
		await expect(handler.execute(cmd({ avatarId: 'theirs' }))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'me');
		expect(repo.save).not.toHaveBeenCalled();
	});

	it('setting an avatar to your own upload succeeds', async () => {
		const { handler, repo, identity, files } = setup();
		await handler.execute(cmd({ avatarId: 'mine' }));
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['mine'], 'me');
		expect(identity.updateDetails).toHaveBeenCalledWith(
			expect.objectContaining({ avatarFileId: 'mine' }),
		);
		expect(repo.save).toHaveBeenCalledWith(identity);
	});

	it('re-sending the current avatar or clearing it skips the check', async () => {
		const { handler, repo, files } = setup('legacy-avatar');
		await handler.execute(cmd({ avatarId: 'legacy-avatar', bio: 'hi' }));
		await handler.execute(cmd({ setAvatarIdNull: true }));
		await handler.execute(cmd({ username: 'name' }));
		expect(files.assertOwnedBy).not.toHaveBeenCalled();
		expect(repo.save).toHaveBeenCalledTimes(3);
	});
});
