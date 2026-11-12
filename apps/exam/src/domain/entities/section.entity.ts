import { ExamStatus } from '../../enums/exam-status.enum';
import { SectionType } from '../../enums/section-type.enum';
import {
	ChildSectionCreatedEvent,
	ChildSectionMovedEvent,
	QuestionCreatedEvent,
	QuestionDeletedEvent,
	QuestionMovedEvent,
	SectionDeletedEvent,
	SectionFileAdded,
	SectionFileRemoved,
	SectionTagAdded,
	SectionTagRemoved,
	SectionUpdatedEvent,
} from '../events/exam-management.event';
import { ExamId } from './exam.entity';
import { clampIndex, orderAt } from './order-position';
import { Question } from './question.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate, IEntity } from '@server/utils';
import { ORDER_RANGE_MEDIUM } from '@server/utils';

// reference to the children of a section, infer based on section.contentType
// if section.contentType is SectionType.SECTION, the children are sections
// else they are questions
export class SectionChild implements IEntity<SectionChild> {
	constructor(
		public readonly id: string,
		public order: number,
	) {}
}

export class Section extends AggregateRoot<Event<any>> implements IAggregate<Section> {
	static newId() {
		return crypto.randomUUID();
	}

	static orderRange: number = ORDER_RANGE_MEDIUM;
	public readonly examId: ExamId;
	public readonly examStatus: ExamStatus;
	public children: SectionChild[];
	public readonly id: string;
	public parentId: string | null;
	public contentType: SectionType;
	public directive: string;
	public name: string | null;
	public tags: Set<string>;
	public fileIds: Set<string>;

	constructor(constructorOptions: {
		examId: ExamId;
		examStatus: ExamStatus;
		children: SectionChild[];
		id: string;
		parentId?: string | null;
		contentType: SectionType;
		name?: string | null;
		directive: string;
		tags: string[];
		fileIds: string[];
	}) {
		super();
		this.id = constructorOptions.id;
		this.examId = constructorOptions.examId;
		this.examStatus = constructorOptions.examStatus;
		this.contentType = constructorOptions.contentType;
		this.children = constructorOptions.children.toSorted((a, b) => a.order - b.order);
		this.parentId = constructorOptions.parentId ?? null;
		this.name = constructorOptions.name ?? null;
		this.directive = constructorOptions.directive;
		this.tags = new Set(constructorOptions.tags);
		this.fileIds = new Set(constructorOptions.fileIds);
	}

	private assertModifiable(): void {
		if (this.examStatus === ExamStatus.Approved)
			throw new ConflictException('Exam is already approved and can no longer be updated.');
	}

	public updateDetails(options: SectionUpdatableProperties): void {
		this.assertModifiable();
		if (options.directive) this.directive = options.directive;
		if (options.name || options.name === null) this.name = options.name;
		if (options.contentType) {
			if (this.children.length > 0)
				throw new ConflictException(
					'Remove the children of this section before changing its type.',
				);
			this.contentType = options.contentType;
		}
		this.apply(
			new SectionUpdatedEvent({
				examId: this.examId,
				sectionId: this.id,
				details: structuredClone(this),
			}),
		);
	}

	public addTag(tag: string) {
		if (this.tags.has(tag)) throw new ConflictException('Tag already exists');
		this.tags.add(tag);
		this.apply(new SectionTagAdded({ sectionId: this.id, tag: tag }));
	}

	public removeTag(tag: string) {
		if (!this.tags.has(tag)) throw new NotFoundException('Tag not found');
		this.tags.delete(tag);
		this.apply(new SectionTagRemoved({ sectionId: this.id, tag: tag }));
	}

	public addFile(fileId: string) {
		this.assertModifiable();
		if (this.fileIds.has(fileId)) throw new ConflictException('File already exists');
		this.fileIds.add(fileId);
		this.apply(new SectionFileAdded({ sectionId: this.id, fileId: fileId }));
	}

	public removeFile(fileId: string) {
		this.assertModifiable();
		if (!this.fileIds.has(fileId)) throw new NotFoundException('File not found');
		this.fileIds.delete(fileId);
		this.apply(new SectionFileRemoved({ sectionId: this.id, fileId: fileId }));
	}

	// These methods are SUPER WRAPPERS...
	public createQuestion(idx = -1): string {
		this.assertModifiable();
		if (this.contentType === SectionType.Section)
			throw new ConflictException(
				'Cannot add questions to section reserved for non-questions only.',
			);
		const questionId = Question.newId();
		const question = this.insertChild(questionId, idx);
		this.apply(new QuestionCreatedEvent({ sectionId: this.id, data: structuredClone(question) }));
		return questionId;
	}

	public createSection(idx = -1): string {
		this.assertModifiable();
		if (this.contentType === SectionType.Question)
			throw new ConflictException('Cannot add sections to section reserved for non-sections only.');
		const sectionId = Section.newId();
		const section = this.insertChild(sectionId, idx);
		this.apply(
			new ChildSectionCreatedEvent({
				examId: this.examId,
				parentId: this.id,
				data: structuredClone(section),
			}),
		);
		return sectionId;
	}

	// These methods are just wrappers to make the code more readable I hope
	public addQuestion(id: string, idx = -1): void {
		this.assertModifiable();
		if (this.contentType !== SectionType.Question)
			throw new ConflictException(
				'Cannot add questions to section reserved for non-questions only.',
			);
		const question = this.insertChild(id, idx);
		this.apply(
			new QuestionMovedEvent({
				sectionId: this.id,
				questionId: question.id,
				data: structuredClone(question),
			}),
		);
	}

	public addSection(id: string, idx = -1): void {
		this.assertModifiable();
		if (this.contentType !== SectionType.Section)
			throw new ConflictException('Cannot add sections to section reserved for non-sections only.');
		const section = this.insertChild(id, idx);
		this.apply(
			new ChildSectionMovedEvent({
				examId: this.examId,
				parentId: this.id,
				sectionId: section.id,
				data: structuredClone(section),
			}),
		);
	}

	public removeQuestion(id: string): void {
		this.assertModifiable();
		if (this.contentType !== SectionType.Question)
			throw new ConflictException('The section only has non-questions');
		const idx = this.children.findIndex(c => c.id === id);
		if (idx === -1) throw new NotFoundException('Question not found');
		this.children.splice(idx, 1);
		this.apply(new QuestionDeletedEvent({ questionId: id }));
	}

	public removeSection(id: string): void {
		this.assertModifiable();
		if (this.contentType !== SectionType.Section)
			throw new ConflictException('The section only has non-sections');
		const idx = this.children.findIndex(c => c.id === id);
		if (idx === -1) throw new NotFoundException('Section not found');
		this.children.splice(idx, 1);
		this.apply(new SectionDeletedEvent({ sectionId: id }));
	}

	/**
	 * Index below 0 or past the end is automatically added to tail (default behavior)
	 * @param id the id of the new child
	 * @param idx the new index (0-based) of the new child
	 */
	private insertChild(id: string, idx = -1): SectionChild {
		if (this.children.find(c => c.id === id)) throw new ConflictException('Child already exists.');
		const target = clampIndex(idx, this.children.length);
		const child = new SectionChild(id, this.orderAt(target));
		this.children.splice(target, 0, child);
		return child;
	}

	private orderAt(idx: number): number {
		return orderAt(this.children, idx, Section.orderRange, () => this.rebalance());
	}

	/**
	 * Move an existing child from one index to another
	 * @param id child id to move
	 * @param toIdx target index (0-based), < 0 or past the end means move to tail
	 */
	public moveChild(id: string, toIdx = -1): void {
		this.assertModifiable();
		const fromIdx = this.children.findIndex(c => c.id === id);
		if (fromIdx === -1) throw new NotFoundException('Child not found');
		const [child] = this.children.splice(fromIdx, 1);
		const target = clampIndex(toIdx, this.children.length);
		if (target !== fromIdx) child.order = this.orderAt(target);
		this.children.splice(target, 0, child);
		if (target === fromIdx) return;
		this.apply(
			this.contentType === SectionType.Question ?
				new QuestionMovedEvent({
					sectionId: this.id,
					questionId: child.id,
					data: structuredClone(child),
				})
			:	new ChildSectionMovedEvent({
					examId: this.examId,
					parentId: this.id,
					sectionId: child.id,
					data: structuredClone(child),
				}),
		);
	}

	private rebalance(): void {
		let x = 0;
		for (const child of this.children) {
			child.order = x++ * Section.orderRange;
			this.apply(
				this.contentType === SectionType.Question ?
					new QuestionMovedEvent({
						sectionId: this.id,
						questionId: child.id,
						data: structuredClone(child),
					})
				:	new ChildSectionMovedEvent({
						examId: this.examId,
						parentId: this.id,
						sectionId: child.id,
						data: structuredClone(child),
					}),
			);
		}
	}
}

type SectionUpdatableProperties = Partial<Pick<Section, 'name' | 'directive' | 'contentType'>>;
