import { GoalType } from '../../enums/goal-type.enum';
import { BadRequestException } from '@nestjs/common';

export type Goal = {
	uid: string;
	date: Date;
	/** In the goal type's own scale (see `goalScales`), e.g. IELTS 6.5 or TOEIC 750. */
	target: number;
	type: string;
};

/** The score range of each test and the step its scores move in. */
export const goalScales: Record<GoalType, { min: number; max: number; step: number }> = {
	[GoalType.Ielts]: { min: 0, max: 9, step: 0.5 },
	[GoalType.Toeic]: { min: 10, max: 990, step: 5 },
	[GoalType.Toefl]: { min: 0, max: 120, step: 1 },
	[GoalType.Vstep]: { min: 0, max: 10, step: 0.5 },
};

const isGoalType = (type: string): type is GoalType => Object.hasOwn(goalScales, type);

/** 400 unless `target` is a score the goal's test can actually give. */
export function assertValidGoalTarget(goal: Pick<Goal, 'target' | 'type'>): void {
	if (!isGoalType(goal.type))
		throw new BadRequestException(`Goal type must be one of ${Object.keys(goalScales).join(', ')}`);
	const { min, max, step } = goalScales[goal.type];
	// the steps (0.5, 1, 5) are exact in binary, so the division is exact for valid scores
	if (
		!Number.isFinite(goal.target) ||
		goal.target < min ||
		goal.target > max ||
		!Number.isInteger(goal.target / step)
	)
		throw new BadRequestException(
			`A ${goal.type} target must be between ${min} and ${max} in steps of ${step}`,
		);
}
