import { ExamStatus } from '../../enums/exam-status.enum';
import {
	ExamDetailsUpdatedEvent,
	ExamStatusUpdatedEvent,
	ExamTagAdded,
	ExamTagRemoved,
	SectionCreatedEvent,
	SectionDeletedEvent,
	SectionMovedEvent,
} from '../events/exam-management.event';
import { AttemptConfig } from './attempt-config.entity';
import { clampIndex, orderAt } from './order-position';
import { Section } from './section.entity';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate, IEntity, IValueObject } from '@server/utils';
import { ORDER_RANGE_MEDIUM } from '@server/utils';

// id with version for optimistic locking
export class ExamId implements IValueObject<ExamId> {
	constructor(
		public readonly id: string,
		public readonly version: number,
	) {}

	equals(other: any): boolean {
		return other instanceof ExamId && this.id === other.id && this.version === other.version;
	}
}

// reference type to sections of exam
export class ExamSection implements IEntity<ExamSection> {
	constructor(
		public readonly id: string,
		public order: number,
	) {}
}

export class Exam extends AggregateRoot<Event<any>> implements IAggregate<Exam, ExamId> {
	public static newId(): ExamId {
		return new ExamId(crypto.randomUUID(), 0);
	}

	public static readonly orderRange: number = ORDER_RANGE_MEDIUM;
	public title: string;
	public duration: number; // in seconds
	public status: ExamStatus;
	public createdBy: string;
	public readonly id: ExamId;
	public description: string | null;
	public sections: ExamSection[];
	public tags: Set<string>;

	public constructor(constructorOptions: {
		id?: ExamId;
		title: string;
		duration: number;
		createdBy: string;
		status: ExamStatus;
		description: string | null;
		sections: ExamSection[];
		tags: string[];
	}) {
		super();
		this.id = constructorOptions.id ?? Exam.newId();
		this.title = constructorOptions.title;
		Exam.assertValidDuration(constructorOptions.duration);
		this.duration = constructorOptions.duration;
		this.createdBy = constructorOptions.createdBy;
		this.status = constructorOptions.status;
		this.description = constructorOptions.description ?? null;
		this.sections = constructorOptions.sections.toSorted((a, b) => a.order - b.order);
		this.tags = new Set(constructorOptions.tags);
	}

	private static assertValidDuration(duration: number): void {
		if (!Number.isInteger(duration) || duration <= 0)
			throw new BadRequestException('Duration must be a positive whole number of seconds');
	}

	private assertModifiable(): void {
		if (this.status === ExamStatus.Approved)
			throw new ConflictException('Exam is already approved and can no longer be updated.');
	}

	public updateDetails(options: ExamUpdatableProperties): void {
		this.assertModifiable();
		if (options.title) this.title = options.title;
		if (options.duration !== undefined) {
			Exam.assertValidDuration(options.duration);
			this.duration = options.duration;
		}
		if (options.description || options.description === null) this.description = options.description;
		this.apply(new ExamDetailsUpdatedEvent({ examId: this.id, data: structuredClone(this) }));
	}

	public updateStatus(status: ExamStatus) {
		this.assertModifiable();
		this.status = status;
		this.apply(new ExamStatusUpdatedEvent({ examId: this.id, status: status }));
	}

	public addTag(tag: string) {
		if (this.tags.has(tag)) throw new ConflictException('Tag already exists');
		this.tags.add(tag);
		this.apply(new ExamTagAdded({ examId: this.id.id, tag: tag }));
	}

	public removeTag(tag: string) {
		if (!this.tags.has(tag)) throw new NotFoundException('Tag not found');
		this.tags.delete(tag);
		this.apply(new ExamTagRemoved({ examId: this.id.id, tag: tag }));
	}

	/**
	 * Index below 0 is automatically added to tail (default behavior)
	 * @param idx the new index (0-based) of the new section
	 */
	public createSection(idx = -1): string {
		this.assertModifiable();
		const sectionId = Section.newId();
		const section = this.insertSection(sectionId, idx);
		this.apply(new SectionCreatedEvent({ examId: this.id, data: structuredClone(section) }));
		return sectionId;
	}

	/**
	 * Index below 0 is automatically added to tail (default behavior)
	 * @param id the id of the new section
	 * @param idx the new index (0-based) of the new section
	 */
	public addSection(id: string, idx = -1): void {
		this.assertModifiable();
		const section = this.insertSection(id, idx);
		this.apply(
			new SectionMovedEvent({
				examId: this.id,
				sectionId: section.id,
				data: structuredClone(section),
			}),
		);
	}

	/**
	 * Private function to avoid duplicate code between createSection and addSection
	 *
	 * Index below 0 or past the end is automatically added to tail (default behavior)
	 * @param id the id of the new section
	 * @param idx the new index (0-based) of the new section
	 */
	private insertSection(id: string, idx = -1): ExamSection {
		if (this.sections.findIndex(s => s.id === id) !== -1)
			throw new ConflictException('Section already exists.');
		const target = clampIndex(idx, this.sections.length);
		const section = new ExamSection(id, this.orderAt(target));
		this.sections.splice(target, 0, section);
		return section;
	}

	private orderAt(idx: number): number {
		return orderAt(this.sections, idx, Exam.orderRange, () => this.rebalance());
	}

	public removeSection(id: string): void {
		this.assertModifiable();
		const idx = this.sections.findIndex(s => s.id === id);
		if (idx === -1) throw new NotFoundException('Section already exists.');
		this.sections.splice(idx, 1);
		this.apply(new SectionDeletedEvent({ sectionId: id }));
	}

	/**
	 * Index below 0 or past the end is automatically moved to tail (default behavior)
	 * @param id the id of the section
	 * @param toIdx the new index (0-based) of the new section
	 */
	public moveSection(id: string, toIdx = -1): void {
		this.assertModifiable();
		const fromIdx = this.sections.findIndex(s => s.id === id);
		if (fromIdx === -1) throw new NotFoundException(`Section not found`);
		const [section] = this.sections.splice(fromIdx, 1);
		const target = clampIndex(toIdx, this.sections.length);
		if (target !== fromIdx) section.order = this.orderAt(target);
		this.sections.splice(target, 0, section);
		if (target === fromIdx) return;
		this.apply(
			new SectionMovedEvent({
				examId: this.id,
				sectionId: section.id,
				data: structuredClone(section),
			}),
		);
	}

	private rebalance(): void {
		let x = 0;
		for (const section of this.sections) {
			section.order = x++ * Exam.orderRange;
			this.apply(
				new SectionMovedEvent({
					examId: this.id,
					sectionId: section.id,
					data: structuredClone(section),
				}),
			);
		}
	}

	public createAttempt(attemptedBy: string, options?: NewAttemptInfo): AttemptConfig {
		if (this.status !== ExamStatus.Approved)
			throw new ConflictException('Exam must be approved before attempting');
		const durationLimit = options?.durationLimit ?? this.duration;
		let sectionIds = options?.sectionIds ?? null;
		if (sectionIds?.length) {
			sectionIds = [...new Set(sectionIds)];
			const sectionIdSet = new Set(this.sections.map(s => s.id));
			const allExist = sectionIds.every(id => sectionIdSet.has(id));
			if (!allExist) throw new ForbiddenException('Section ids must belong to the correct exam id');
			// if select everything, don't store redundancy
			if (sectionIds.length === this.sections.length) sectionIds = null;
		}
		const isStrict =
			(sectionIds === null || sectionIds.length === 0) && durationLimit === this.duration;
		return new AttemptConfig({
			attemptedBy: attemptedBy,
			isStrict: isStrict,
			durationLimit: durationLimit,
			examId: this.id,
			sectionIds: sectionIds,
		});
	}
}

type NewAttemptInfo = Partial<Pick<AttemptConfig, 'durationLimit' | 'sectionIds'>>;

type ExamUpdatableProperties = Partial<Pick<Exam, 'title' | 'duration' | 'description'>>;
