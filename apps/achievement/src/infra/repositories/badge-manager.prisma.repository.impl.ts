import { AttemptCounterBadgeManager } from '../../domain/entities/attempt-counter-badge-manager.entity';
import { AttemptScoreBadgeManager } from '../../domain/entities/attempt-score-badge-manager.entity';
import { LoginBadgeManager } from '../../domain/entities/login-badge-manager.entity';
import { BadgeAddedEvent } from '../../domain/events/badge.event';
import { IBadgeManagerRepository } from '../../domain/repositories/badge-manager.repository';
import { Badge, BadgeType } from '../../enums/badge.enum';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import {
	AttemptCriteria,
	LoginCriteria,
	Prisma,
	PrismaClient,
	UserBadge,
} from '@prisma-client/achievement';
import { OutboxPublisher } from '@server/messaging';
import { Event, parseEnum } from '@server/utils';

class BadgeManagerPrismaMapper {
	static mapBadge(from: string): Badge {
		return parseEnum(Badge, from);
	}

	static toAttemptCounterBadgeManager(
		from: AttemptCriteria,
		badges: UserBadge[],
	): AttemptCounterBadgeManager {
		return new AttemptCounterBadgeManager({
			id: from.uid,
			total: from.total,
			version: from.version,
			badges: badges.map(b => this.mapBadge(b.badgeName)),
		});
	}

	static toAttemptScoreBadgeManager(
		from: AttemptCriteria,
		badges: UserBadge[],
	): AttemptScoreBadgeManager {
		return new AttemptScoreBadgeManager({
			id: from.uid,
			good: from.good,
			perfect: from.perfect,
			version: from.version,
			badges: badges.map(b => this.mapBadge(b.badgeName)),
		});
	}

	static toLoginBadgeManager(from: LoginCriteria, badges: UserBadge[]): LoginBadgeManager {
		return new LoginBadgeManager({
			id: from.uid,
			longestStreak: from.longestStreak,
			lastLogin: from.lastLogin,
			startedAt: from.startedAt,
			total: from.total,
			version: from.version,
			badges: badges.map(b => this.mapBadge(b.badgeName)),
		});
	}

	static toOrm(
		from: AttemptCounterBadgeManager | AttemptScoreBadgeManager,
	): Prisma.AttemptCriteriaUpdateInput;
	static toOrm(from: LoginBadgeManager): Prisma.LoginCriteriaUpdateInput;
	static toOrm(
		from: AttemptCounterBadgeManager | AttemptScoreBadgeManager | LoginBadgeManager,
	): Prisma.AttemptCriteriaUpdateInput | Prisma.LoginCriteriaUpdateInput {
		if (from instanceof LoginBadgeManager)
			return {
				lastLogin: from.lastLogin,
				startedAt: from.startedAt,
				total: from.total,
				longestStreak: from.longestStreak,
			};
		else if (from instanceof AttemptCounterBadgeManager) return { total: from.total };
		else return { good: from.good, perfect: from.perfect };
	}
}

@Injectable()
export class BadgeManagerPrismaRepositoryImpl implements IBadgeManagerRepository {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly outbox: OutboxPublisher,
	) {}

	async getAttemptCounterBadgeManager(uid: string): Promise<AttemptCounterBadgeManager> {
		const foundManager = await this.txHost.tx.attemptCriteria.upsert({
			where: { uid: uid },
			update: {},
			create: { uid: uid },
		});
		const badges = await this.txHost.tx.userBadge.findMany({
			where: { uid: uid, badge: { type: BadgeType.AttemptCount } },
		});
		const manager = BadgeManagerPrismaMapper.toAttemptCounterBadgeManager(foundManager, badges);
		return manager;
	}

	async getAttemptScoreBadgeManager(uid: string): Promise<AttemptScoreBadgeManager> {
		const foundManager = await this.txHost.tx.attemptCriteria.upsert({
			where: { uid: uid },
			update: {},
			create: { uid: uid },
		});
		const badges = await this.txHost.tx.userBadge.findMany({
			where: { uid: uid, badge: { type: BadgeType.AttemptScore } },
		});
		const manager = BadgeManagerPrismaMapper.toAttemptScoreBadgeManager(foundManager, badges);
		return manager;
	}

	async getLoginBadgeManager(uid: string): Promise<LoginBadgeManager> {
		const foundManager = await this.txHost.tx.loginCriteria.upsert({
			where: { uid: uid },
			update: {},
			create: { uid: uid, startedAt: new Date(), lastLogin: new Date() },
		});
		const badges = await this.txHost.tx.userBadge.findMany({
			where: { uid: uid, badge: { type: BadgeType.Login } },
		});
		const manager = BadgeManagerPrismaMapper.toLoginBadgeManager(foundManager, badges);
		return manager;
	}

	async saveAttemptCounterBadgeManager(manager: AttemptCounterBadgeManager): Promise<void> {
		const data = BadgeManagerPrismaMapper.toOrm(manager);
		return await this.txHost.withTransaction(async () => {
			await this.txHost.tx.attemptCriteria.update({
				where: { uid: manager.id, version: manager.version },
				data: { ...data, version: { increment: 1 } },
			});

			for (const event of manager.getUncommittedEvents()) {
				await this.handle(event);
			}
		});
	}

	async saveAttemptScoreBadgeManager(manager: AttemptScoreBadgeManager): Promise<void> {
		const data = BadgeManagerPrismaMapper.toOrm(manager);
		return await this.txHost.withTransaction(async () => {
			await this.txHost.tx.attemptCriteria.update({
				where: { uid: manager.id, version: manager.version },
				data: { ...data, version: { increment: 1 } },
			});

			for (const event of manager.getUncommittedEvents()) {
				await this.handle(event);
			}
		});
	}

	async saveLoginBadgeManager(manager: LoginBadgeManager): Promise<void> {
		const data = BadgeManagerPrismaMapper.toOrm(manager);
		return await this.txHost.withTransaction(async () => {
			await this.txHost.tx.loginCriteria.update({
				where: { uid: manager.id, version: manager.version },
				data: { ...data, version: { increment: 1 } },
			});

			for (const event of manager.getUncommittedEvents()) {
				await this.handle(event);
			}
		});
	}

	private async handle(event: Event<any>): Promise<void> {
		if (event instanceof BadgeAddedEvent) return this.onBadgeAdded(event);
	}

	private async onBadgeAdded(event: BadgeAddedEvent): Promise<void> {
		try {
			await this.txHost.tx.userBadge.create({
				data: { badgeName: event.payload.badge, uid: event.payload.uid },
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') return;
			}
			throw e;
		}
		// Same transaction as the award: a rolled-back or retried attempt publishes nothing.
		await this.outbox.add('achievement.badge.earned', {
			uid: event.payload.uid,
			badgeName: event.payload.badge,
		});
	}
}
