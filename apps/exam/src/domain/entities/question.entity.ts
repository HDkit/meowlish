import { ExamStatus } from '../../enums/exam-status.enum';
import {
	QuestionType,
	questionTypesWithMultipleCorrectChoices,
} from '../../enums/question-type.enum';
import {
	ChoiceCreatedEvent,
	ChoiceDeletedEvent,
	ChoiceUpdatedEvent,
	QuestionFileAdded,
	QuestionFileRemoved,
	QuestionTagAdded,
	QuestionTagRemoved,
	QuestionUpdatedEvent,
} from '../events/exam-management.event';
import { ExamId } from './exam.entity';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate, IEntity } from '@server/utils';

export class Choice implements IEntity<Choice> {
	public static newId(): string {
		return crypto.randomUUID();
	}

	public readonly id: string;
	public isCorrect: boolean;
	public key: string;
	public content: string | null;

	public constructor(constructorOptions: {
		id?: string;
		isCorrect?: boolean;
		key?: string;
		content?: string | null;
	}) {
		this.id = constructorOptions.id ?? Choice.newId();
		this.isCorrect = constructorOptions.isCorrect ?? false;
		this.key = constructorOptions.key ?? '';
		this.content = constructorOptions.content ?? null;
	}

	public updateDetails(options: ChoiceUpdatableProperties) {
		if (options.content || options.content === null) this.content = options.content;
		if (options.isCorrect !== undefined) this.isCorrect = options.isCorrect;
		if (options.key) this.key = options.key;
	}
}

export class Question extends AggregateRoot<Event<any>> implements IAggregate<Question> {
	public static newId(): string {
		return crypto.randomUUID();
	}

	public readonly id: string;
	public readonly examId: ExamId;
	public readonly examStatus: ExamStatus;
	public sectionId: string;
	public content: string;
	public type: QuestionType;
	public points: number;
	public explanation: string;
	public choices: Choice[];
	public tags: Set<string>;
	public fileIds: Set<string>;

	public constructor(constructorOptions: {
		id: string;
		examId: ExamId;
		examStatus: ExamStatus;
		sectionId: string;
		content: string;
		type: QuestionType;
		points: number;
		explanation: string;
		choices: Choice[];
		tags: string[];
		fileIds: string[];
	}) {
		super();
		this.id = constructorOptions.id;
		this.examId = constructorOptions.examId;
		this.examStatus = constructorOptions.examStatus;
		this.sectionId = constructorOptions.sectionId;
		this.content = constructorOptions.content;
		this.type = constructorOptions.type;
		this.points = constructorOptions.points;
		this.explanation = constructorOptions.explanation;
		this.choices = constructorOptions.choices;
		this.tags = new Set(constructorOptions.tags);
		this.fileIds = new Set(constructorOptions.fileIds);
	}

	private assertModifiable(): void {
		if (this.examStatus === ExamStatus.Approved)
			throw new ConflictException('Exam is already approved and can no longer be updated.');
	}

	public updateDetails(options: {
		content?: string;
		explanation?: string;
		points?: number;
		type?: QuestionType;
	}): void {
		this.assertModifiable();
		if (options.content) this.content = options.content;
		if (options.explanation) this.explanation = options.explanation;
		if (options.points !== undefined) {
			// 0 is a valid weight (e.g. an unscored practice question)
			if (!Number.isInteger(options.points) || options.points < 0)
				throw new BadRequestException('Points must be a non-negative whole number');
			this.points = options.points;
		}
		if (options.type) this.type = options.type;
		this.apply(new QuestionUpdatedEvent({ parentId: this.sectionId, data: structuredClone(this) }));
	}
	public addTag(tag: string) {
		if (this.tags.has(tag)) throw new ConflictException('Tag already exists');
		this.tags.add(tag);
		this.apply(new QuestionTagAdded({ questionId: this.id, tag: tag }));
	}

	public removeTag(tag: string) {
		if (!this.tags.has(tag)) throw new NotFoundException('Tag not found');
		this.tags.delete(tag);
		this.apply(new QuestionTagRemoved({ questionId: this.id, tag: tag }));
	}

	public addFile(fileId: string) {
		this.assertModifiable();
		if (this.fileIds.has(fileId)) throw new ConflictException('File already exists');
		this.fileIds.add(fileId);
		this.apply(new QuestionFileAdded({ questionId: this.id, fileId: fileId }));
	}

	public removeFile(fileId: string) {
		this.assertModifiable();
		if (!this.fileIds.has(fileId)) throw new NotFoundException('File not found');
		this.fileIds.delete(fileId);
		this.apply(new QuestionFileRemoved({ questionId: this.id, fileId: fileId }));
	}

	public addChoice(choice: Choice): void {
		this.assertModifiable();
		if (this.choices.some(c => c.id === choice.id))
			throw new ConflictException('Choice already exists');
		if (this.choices.find(c => c.key === choice.key))
			throw new ConflictException('Choice must not have duplicate key');
		this.choices.push(choice);
		this.apply(new ChoiceCreatedEvent({ questionId: this.id, data: structuredClone(choice) }));
	}

	/**
	 * Single-correct question types (MCQ, Fill, Writing) may have only one correct choice.
	 *
	 * Checked once, after a whole batch of edits (type, addChoice, updateChoice, removeChoice), not
	 * per operation: an intermediate state may briefly hold two correct choices, e.g. marking B
	 * before un-marking A, or switching MCQ_MULTI → MCQ in the same request that un-marks the
	 * extra choice. Whoever mutates choices must call this before saving.
	 */
	public assertChoicesConsistent(): void {
		if (questionTypesWithMultipleCorrectChoices.includes(this.type)) return;
		if (this.choices.filter(c => c.isCorrect).length > 1)
			throw new ConflictException('This type of question only allows one correct choice');
	}

	public removeChoice(choiceOrChoiceId: string | Choice): void {
		this.assertModifiable();
		const choiceId = choiceOrChoiceId instanceof Choice ? choiceOrChoiceId.id : choiceOrChoiceId;
		const idx = this.choices.findIndex(c => c.id === choiceId);
		if (idx === -1) throw new NotFoundException('Choice not found');
		this.choices.splice(idx, 1);
		this.apply(new ChoiceDeletedEvent({ choiceId: choiceId }));
	}

	public updateChoice(choiceId: string, options: ChoiceUpdatableProperties) {
		this.assertModifiable();
		const choice = this.choices.find(c => c.id === choiceId);
		if (!choice) throw new NotFoundException('Choice not found');
		if (options.key && options.key !== choice.key && this.choices.some(c => c.key === options.key))
			throw new ConflictException('Choice must not have duplicate key');
		choice.updateDetails(options);
		this.apply(
			new ChoiceUpdatedEvent({
				questionId: this.id,
				choiceId: choiceId,
				data: structuredClone(choice),
			}),
		);
	}
}

type ChoiceUpdatableProperties = Partial<Pick<Choice, 'content' | 'isCorrect' | 'key'>>;
