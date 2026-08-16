import { Badge, UserBadge } from '../../domain/read-models/badge.read-model';
import { Progress } from '../../domain/read-models/progress.read-model';
import { IBadgeReadRepository } from '../../domain/repositories/badge.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/achievement';
import { differenceInCalendarDays } from 'date-fns';

@Injectable()
export class BadgeReadPrismaRepositoryImpl implements IBadgeReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getAll(): Promise<Badge[]> {
		const badges = await this.txHost.tx.badge.findMany({ orderBy: { name: 'desc' } });
		return badges.map(b => ({
			name: b.name,
			displayName: b.displayName,
			description: b.description,
		}));
	}

	/**
	 * Sort from latest to oldest updated time + id
	 */
	async getUsersBadges(
		userId: string,
		opts?: { lastId?: string; limit?: number },
	): Promise<UserBadge[]> {
		if (opts?.limit && opts.limit < 0) throw new BadRequestException('Limit must be positive');

		const badges = await this.txHost.tx.userBadge.findMany({
			where: { uid: userId },
			orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
			select: {
				id: true,
				badge: { select: { name: true, displayName: true, description: true } },
				updatedAt: true,
			},
			take: opts?.limit ?? 10,
			...(opts?.lastId && {
				cursor: { id: opts.lastId },
				skip: 1,
			}),
		});
		return badges.map(b => ({
			id: b.id,
			name: b.badge.name,
			displayName: b.badge.displayName,
			description: b.badge.description,
			date: b.updatedAt,
		}));
	}

	async getUsersProgress(userId: string): Promise<Progress> {
		const loginProgress = await this.txHost.tx.loginCriteria.findUnique({ where: { uid: userId } });
		const submissionProgress = await this.txHost.tx.attemptCriteria.findUnique({
			where: { uid: userId },
		});

		return {
			loginProgress:
				loginProgress ?
					{
						longestStreak: loginProgress.longestStreak,
						streak: differenceInCalendarDays(loginProgress.lastLogin, loginProgress.startedAt),
						total: loginProgress.total,
					}
				:	undefined,
			submissionProgress:
				submissionProgress ?
					{
						goodScore: submissionProgress.good,
						perfectScore: submissionProgress.perfect,
						total: submissionProgress.total,
					}
				:	undefined,
		};
	}
}
