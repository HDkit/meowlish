import { ExamManagementController } from './exam-management.controller';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const setup = (creator: string | null = 'mod-a') => {
	const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
	const repo = { getExamCreator: jest.fn().mockResolvedValue(creator) };
	const controller = new ExamManagementController(commandBus as never, {} as never, repo as never);
	return { commandBus: commandBus, repo: repo, controller: controller };
};

const creator = { requesterId: 'mod-a', privileged: false };
const otherMod = { requesterId: 'mod-b', privileged: false };
const admin = { requesterId: 'admin-1', privileged: true };

describe('ExamManagementController ownership', () => {
	it('creator can edit sections', async () => {
		const { controller, commandBus, repo } = setup();
		await controller.updateSection({ id: 's1', ...creator } as never);
		expect(repo.getExamCreator).toHaveBeenCalledWith({ sectionId: 's1' });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
	});

	it("admin can edit another creator's question", async () => {
		const { controller, commandBus } = setup();
		await controller.updateQuestion({ id: 'q1', ...admin } as never);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
	});

	it.each([
		['updateExam', { id: 'e1' }],
		['deleteExam', { id: 'e1' }],
		['createSection', { examId: 'e1' }],
		['createSection', { sectionId: 's1' }],
		['createQuestion', { sectionId: 's1' }],
		['updateSection', { id: 's1' }],
		['updateQuestion', { id: 'q1' }],
		['deleteSection', { id: 's1' }],
		['deleteQuestion', { id: 'q1' }],
		['moveSection', { id: 's1' }],
		['moveQuestion', { id: 'q1' }],
	] as const)("mod cannot edit another mod's exam via %s (403)", async (method, payload) => {
		const { controller, commandBus } = setup();
		await expect(
			(controller[method] as (r: unknown) => Promise<unknown>)({ ...payload, ...otherMod }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('returns 404 when the exam does not exist', async () => {
		const { controller, commandBus } = setup(null);
		await expect(controller.deleteExam({ id: 'e1', ...admin })).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it("blocks moving a section under another creator's section", async () => {
		const { controller, repo, commandBus } = setup();
		repo.getExamCreator.mockResolvedValueOnce('mod-b').mockResolvedValueOnce('mod-a');
		await expect(
			controller.moveSection({ id: 's1', parentId: 's9', ...otherMod }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});
});
