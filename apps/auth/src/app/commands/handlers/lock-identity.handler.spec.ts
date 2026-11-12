import { LockIdentityCommand } from '../auth.lock-identity.command';
import { LockIdentityCommandHandler } from './lock-identity.handler';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@server/typing';

const setup = (roles: Record<string, Role[]>) => {
	const identity = { lock: jest.fn(), getUncommittedEvents: () => [] };
	const repo = {
		findOneById: jest.fn().mockResolvedValue(identity),
		getClaimsOfId: jest.fn((id: string) =>
			Promise.resolve({ roles: roles[id] ?? [], permissions: [] }),
		),
		save: jest.fn(),
	};
	const handler = new LockIdentityCommandHandler(repo as never, { publishAll: jest.fn() } as never);
	return { handler: handler, repo: repo, identity: identity };
};

const lock = (identityId: string, lockedBy: string) =>
	new LockIdentityCommand({ identityId: identityId, lockedBy: lockedBy });

describe('LockIdentityCommandHandler', () => {
	it('lets a mod lock a regular user', async () => {
		const { handler, identity } = setup({ mod: [Role.Mod], user: [Role.User] });
		await handler.execute(lock('user', 'mod'));
		expect(identity.lock).toHaveBeenCalledWith('mod');
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
