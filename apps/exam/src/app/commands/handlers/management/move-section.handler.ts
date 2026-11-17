import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import {
	type ISectionRepository,
	ISectionRepositoryToken,
} from '../../../../domain/repositories/section.repository';
import { MoveSectionCommand } from '../../staff/exam.move-section.command';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(MoveSectionCommand)
export class MoveSectionHandler implements ICommandHandler<MoveSectionCommand> {
	constructor(
		@Inject(IExamRepositoryToken) private readonly examRepository: IExamRepository,
		@Inject(ISectionRepositoryToken) private readonly sectionRepository: ISectionRepository,
	) {}

	public async execute(command: MoveSectionCommand): Promise<void> {
		const { parentId, id: sectionId, index, toRoot } = command.payload;

		// move to new section
		if (parentId) {
			// the closure trigger would refuse it too, but as an opaque database error (502)
			if (await this.sectionRepository.isInSubtreeOf(parentId, sectionId))
				throw new BadRequestException('Cannot move a section under itself or its descendant');
			// can only move to section in the exam
			const newParentSection = await this.sectionRepository.findOneInTheSameExamAsSection(
				parentId,
				sectionId,
			);
			if (!newParentSection) throw new NotFoundException('Section not found');
			newParentSection.addSection(sectionId, index);
			return await this.sectionRepository.save(newParentSection);
		}
		// move to root (child of exam)
		else if (toRoot) {
			const exam = await this.examRepository.getParentExamOfSection(sectionId);
			exam.addSection(sectionId, index);
			return await this.examRepository.save(exam);
		}
		// move within existing parent container
		else {
			// check to see if parent is exam or section
			const parentSection = await this.sectionRepository.getParentSectionOfSection(sectionId);
			if (!parentSection) {
				const exam = await this.examRepository.getParentExamOfSection(sectionId);
				exam.moveSection(sectionId, index);
				return await this.examRepository.save(exam);
			} else {
				parentSection.moveChild(sectionId, index);
				return await this.sectionRepository.save(parentSection);
			}
		}
	}
}
