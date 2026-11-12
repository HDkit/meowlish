import { LockIdentityCommand } from '../auth.lock-identity.command';
import { LockIdentityCommandHandler } from './lock-identity.handler';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@server/typing';

// execute() is @Transactional(); register the static host it looks up, backed by a no-op adapter.
const txHost = new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const setup = (roles: Record<string, Role[]>) => {
	const identity = { lock: jest.fn(), getUncommittedEvents: () => [] };
	const repo = {
		findOneById: jest.fn().mockResolvedValue(identity),
		getClaimsOfId: jest.fn((id: string) =>
			Promise.resolve({ roles: roles[id] ?? [], permissions: [] }),
		),
		save: jest.fn(),
	};
	const publisher = {
		publish: jest.fn(() => {
			if (!txHost.isTransactionActive()) throw new Error('publish outside a transaction');
			return Promise.resolve();
		}),
	};
	const handler = new LockIdentityCommandHandler(repo as never, publisher as never);
	return { handler: handler, repo: repo, identity: identity, publisher: publisher };
};

const lock = (identityId: string, lockedBy: string) =>
	new LockIdentityCommand({ identityId: identityId, lockedBy: lockedBy });

describe('LockIdentityCommandHandler', () => {
	it('lets a mod lock a regular user', async () => {
		const { handler, identity, publisher } = setup({ mod: [Role.Mod], user: [Role.User] });
		await handler.execute(lock('user', 'mod'));
		expect(identity.lock).toHaveBeenCalledWith('mod');
		expect(publisher.publish).toHaveBeenCalledTimes(1);
	});

	it.each([
		['a mod locking an admin', Role.Mod, Role.Admin],
		['a mod locking another mod', Role.Mod, Role.Mod],
		['an admin locking another admin', Role.Admin, Role.Admin],
	])('forbids %s', async (_label, lockerRole, targetRole) => {
		const { handler, repo } = setup({ locker: [lockerRole], target: [targetRole] });
		await expect(handler.execute(lock('target', 'locker'))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(repo.save).not.toHaveBeenCalled();
	});

	it('forbids locking yourself', async () => {
		const { handler } = setup({ admin: [Role.Admin] });
		await expect(handler.execute(lock('admin', 'admin'))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
	});
});
