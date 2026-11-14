import { Goal } from '../../domain/entities/goal.entity';
import { IGoalRepository } from '../../domain/repositories/goal.repository';
import { translatePrismaErrors } from './prisma-errors';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/exam';

const goalNotFound = (): Error => new NotFoundException('Goal not found');

@Injectable()
export class GoalPrismaRepositoryImpl implements IGoalRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async setGoal(goal: Goal): Promise<Goal> {
		return await translatePrismaErrors(() => this.txHost.tx.goal.create({ data: goal }), {
			P2002: () => new ConflictException('A goal is already set: update it instead'),
		});
	}

	async deleteGoal(uid: string): Promise<void> {
		await translatePrismaErrors(() => this.txHost.tx.goal.delete({ where: { uid: uid } }), {
			P2025: goalNotFound,
		});
	}

	async updateGoal(goal: Goal): Promise<Goal> {
		return await translatePrismaErrors(
			() => this.txHost.tx.goal.update({ where: { uid: goal.uid }, data: goal }),
			{ P2025: goalNotFound },
		);
	}

	async getGoal(uid: string): Promise<Goal | null> {
		const foundGoal = await this.txHost.tx.goal.findUnique({ where: { uid: uid } });
		return foundGoal ?? null;
	}
}
