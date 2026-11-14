import { Goal, assertValidGoalTarget } from '../../domain/entities/goal.entity';
import {
	type IGoalRepository,
	IGoalRepositoryToken,
} from '../../domain/repositories/goal.repository';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class GoalService {
	constructor(@Inject(IGoalRepositoryToken) private readonly goalRepository: IGoalRepository) {}

	async setGoal(goal: Goal): Promise<Goal> {
		assertValidGoalTarget(goal);
		return await this.goalRepository.setGoal(goal);
	}

	async deleteGoal(uid: string): Promise<void> {
		await this.goalRepository.deleteGoal(uid);
	}

	async updateGoal(goal: Goal): Promise<Goal> {
		assertValidGoalTarget(goal);
		return await this.goalRepository.updateGoal(goal);
	}

	async getGoal(uid: string): Promise<Goal> {
		const goal = await this.goalRepository.getGoal(uid);
		if (!goal) throw new NotFoundException('Goal not found');
		return goal;
	}
}
