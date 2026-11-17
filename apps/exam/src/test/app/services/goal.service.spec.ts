import { GoalService } from '../../../app/services/goal.service';
import { Goal } from '../../../domain/entities/goal.entity';
import { BadRequestException } from '@nestjs/common';

const setup = () => {
	const repo = {
		setGoal: jest.fn().mockImplementation((g: Goal) => Promise.resolve(g)),
		updateGoal: jest.fn().mockImplementation((g: Goal) => Promise.resolve(g)),
		deleteGoal: jest.fn(),
		getGoal: jest.fn(),
	};
	return { repo: repo, service: new GoalService(repo) };
};

const goal = (target: number, type = 'IELTS'): Goal => ({
	uid: 'u1',
	date: new Date('2027-01-01'),
	target: target,
	type: type,
});

describe('GoalService targets (C25)', () => {
	it('stores a half band (IELTS 6.5)', async () => {
		const { repo, service } = setup();
		await expect(service.setGoal(goal(6.5))).resolves.toMatchObject({ target: 6.5 });
		expect(repo.setGoal).toHaveBeenCalledWith(goal(6.5));
	});

	it('updates to a VSTEP half band', async () => {
		const { repo, service } = setup();
		await service.updateGoal(goal(7.5, 'VSTEP'));
		expect(repo.updateGoal).toHaveBeenCalledWith(goal(7.5, 'VSTEP'));
	});

	it.each([
		['set', (s: GoalService) => s.setGoal(goal(750))],
		['update', (s: GoalService) => s.updateGoal(goal(752, 'TOEIC'))],
	])('rejects a target outside the scale on %s, before saving', async (_name, run) => {
		const { repo, service } = setup();
		await expect(run(service)).rejects.toBeInstanceOf(BadRequestException);
		expect(repo.setGoal).not.toHaveBeenCalled();
		expect(repo.updateGoal).not.toHaveBeenCalled();
	});
});
