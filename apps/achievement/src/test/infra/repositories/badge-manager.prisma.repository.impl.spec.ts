import { BADGE_INFORMATION } from '../../../constants/badge-info.const';
import { LoginBadgeManager } from '../../../domain/entities/login-badge-manager.entity';
import { BadgeAddedEvent } from '../../../domain/events/badge.event';
import { Badge } from '../../../enums/badge.enum';
import { BadgeManagerPrismaRepositoryImpl } from '../../../infra/repositories/badge-manager.prisma.repository.impl';

jest.mock('@prisma-client/achievement', () => ({
	Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

describe('BadgeManagerPrismaRepositoryImpl badge award', () => {
	const setup = () => {
		const userBadgeCreate = jest.fn().mockResolvedValue({ count: 1 });
		const outbox = { add: jest.fn().mockResolvedValue({}) };
		const tx = {
			loginCriteria: { update: jest.fn().mockResolvedValue({}) },
			userBadge: { createMany: userBadgeCreate },
		};
		const txHost = { tx: tx, withTransaction: (fn: () => Promise<void>) => fn() };
		const repo = new BadgeManagerPrismaRepositoryImpl(txHost as never, outbox as never);
		const manager = new LoginBadgeManager({
			id: 'u1',
			longestStreak: 0,
			lastLogin: new Date(),
			startedAt: new Date(),
			total: 0,
			version: 0,
			badges: [],
		});
		jest
			.spyOn(manager, 'getUncommittedEvents')
			.mockReturnValue([new BadgeAddedEvent({ uid: 'u1', badge: Badge.LoginSevenDays })]);
		return { repo: repo, manager: manager, outbox: outbox, userBadgeCreate: userBadgeCreate };
	};

	it('publishes exactly one achievement.badge.earned with { uid, badgeName }', async () => {
		const { repo, manager, outbox } = setup();
		await repo.saveLoginBadgeManager(manager);
		expect(outbox.add).toHaveBeenCalledTimes(1);
		expect(outbox.add).toHaveBeenCalledWith('achievement.badge.earned', {
			uid: 'u1',
			badgeName: BADGE_INFORMATION[Badge.LoginSevenDays].displayName,
		});
	});

	it('skips a badge already awarded without aborting the transaction, and publishes nothing', async () => {
		const { repo, manager, outbox, userBadgeCreate } = setup();
		userBadgeCreate.mockResolvedValueOnce({ count: 0 });
		await repo.saveLoginBadgeManager(manager);
		expect(userBadgeCreate).toHaveBeenCalledWith({
			data: [{ badgeName: Badge.LoginSevenDays, uid: 'u1' }],
			skipDuplicates: true,
		});
		expect(outbox.add).not.toHaveBeenCalled();
	});

	it('publishes nothing when the award fails, so a retry cannot double-publish', async () => {
		const { repo, manager, outbox, userBadgeCreate } = setup();
		userBadgeCreate.mockRejectedValueOnce(new Error('boom'));
		await expect(repo.saveLoginBadgeManager(manager)).rejects.toThrow('boom');
		expect(outbox.add).not.toHaveBeenCalled();
	});
});
