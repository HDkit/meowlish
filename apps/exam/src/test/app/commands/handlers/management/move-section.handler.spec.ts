import { MoveSectionHandler } from '../../../../../app/commands/handlers/management/move-section.handler';
import {
	MoveSectionCommand,
	MoveSectionCommandPayload,
} from '../../../../../app/commands/staff/exam.move-section.command';
import { BadRequestException } from '@nestjs/common';

const setup = (inSubtree: boolean) => {
	const destination = { addSection: jest.fn() };
	const sections = {
		isInSubtreeOf: jest.fn().mockResolvedValue(inSubtree),
		findOneInTheSameExamAsSection: jest.fn().mockResolvedValue(destination),
		save: jest.fn().mockResolvedValue(undefined),
	};
	const handler = new MoveSectionHandler({} as never, sections as never);
	return { sections: sections, destination: destination, handler: handler };
};

describe('MoveSectionHandler cycles', () => {
	it('refuses to move a section under its own descendant with a 400', async () => {
		const { handler, sections } = setup(true);
		await expect(
			handler.execute(
				new MoveSectionCommand(
					new MoveSectionCommandPayload({ id: 's1', index: 0, parentId: 's2' }),
				),
			),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(sections.isInSubtreeOf).toHaveBeenCalledWith('s2', 's1');
		expect(sections.save).not.toHaveBeenCalled();
	});

	it('moves it under another section', async () => {
		const { handler, sections, destination } = setup(false);
		await handler.execute(
			new MoveSectionCommand(new MoveSectionCommandPayload({ id: 's1', index: 0, parentId: 's2' })),
		);
		expect(destination.addSection).toHaveBeenCalledWith('s1', 0);
		expect(sections.save).toHaveBeenCalledWith(destination);
	});
});
