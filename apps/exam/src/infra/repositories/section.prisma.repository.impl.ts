import { ExamId } from '../../domain/entities/exam.entity';
import { Section, SectionChild } from '../../domain/entities/section.entity';
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
} from '../../domain/events/exam-management.event';
import { ISectionRepository } from '../../domain/repositories/section.repository';
import { ExamStatus } from '../../enums/exam-status.enum';
import { SectionType } from '../../enums/section-type.enum';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
	Prisma,
	PrismaClient,
	Question as PrismaQuestion,
	Section as PrismaSection,
} from '@prisma-client/exam';
import { parseEnum } from '@server/utils';
import { Event } from '@server/utils';

class SectionPrismaMapper {
	static mapExamStatus(from: string): ExamStatus {
		return parseEnum(ExamStatus, from);
	}

	static mapSectionType(from: string): SectionType {
		return parseEnum(SectionType, from);
	}

	static toSectionAggregate(from: ExtendedSection): Section {
		let children: SectionChild[];
		const contentType: SectionType = this.mapSectionType(from.contentType);

		// map children
		if (contentType === SectionType.Question) {
			children = from.questions.map(q => new SectionChild(q.id, q.order));
		} else if (contentType === SectionType.Section) {
			children = from.childSections.map(s => new SectionChild(s.id, s.order));
		} else children = [];

		return new Section({
			id: from.id,
			directive: from.directive,
			name: from.name,
			parentId: from.parentId,
			examId: new ExamId(from.exam.id, from.exam.version),
			examStatus: this.mapExamStatus(from.exam.status),
			children: children,
			contentType: contentType,
			fileIds: from.sectionFiles.map(f => f.fileId),
			tags: from.sectionTags.map(t => t.tag.name),
		});
	}

	static toChildQuestionOrm(from: SectionChild, parentId: string): RepoChildQuestion {
		return {
			id: from.id,
			order: from.order,
			sectionId: parentId,
		};
	}

	static toChildSectionOrm(from: SectionChild, parentId: string, examId: string): RepoChildSection {
		return {
			id: from.id,
			order: from.order,
			parentId: parentId,
			examId: examId,
		};
	}

	static toParentSectionOrm(from: Section): RepoSection {
		return {
			id: from.id,
			contentType: from.contentType,
			directive: from.directive,
			examId: from.examId.id,
			name: from.name,
			parentId: from.parentId,
		};
	}
}

@Injectable()
export class SectionPrismaRepositoryImpl implements ISectionRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async findOne(id: string): Promise<Section | null> {
		const foundSection = await this.txHost.tx.section.findUnique({
			where: { id: id },
			include: sectionPrismaIncludeObject,
		});
		return foundSection ? SectionPrismaMapper.toSectionAggregate(foundSection) : null;
	}

	async getParentSectionOfQuestion(id: string): Promise<Section> {
		const foundQuestion = await this.txHost.tx.question.findUnique({
			where: { id: id },
			include: { section: { include: sectionPrismaIncludeObject } },
		});
		if (!foundQuestion) throw new NotFoundException('Question not found.');
		return SectionPrismaMapper.toSectionAggregate(foundQuestion.section);
	}

	async getParentSectionOfSection(id: string): Promise<Section | null> {
		const foundSection = await this.txHost.tx.section.findUnique({
			where: { id: id },
			include: { parentSection: { include: sectionPrismaIncludeObject } },
		});
		if (!foundSection) throw new NotFoundException('Section not found.');
		const foundParentSection = foundSection.parentSection;
		return foundParentSection ? SectionPrismaMapper.toSectionAggregate(foundParentSection) : null;
	}

	// check again
	async findOneInTheSameExamAsSection(id: string, sectionId: string): Promise<Section | null> {
		const foundBaseSection = await this.txHost.tx.section.findUnique({
			where: {
				id: sectionId,
			},
			select: { examId: true },
		});

		if (!foundBaseSection)
			throw new NotFoundException(`Section id ${sectionId} could not be found`);

		const foundSection = await this.txHost.tx.section.findUnique({
			where: { id: id, examId: foundBaseSection.examId },
			include: sectionPrismaIncludeObject,
		});
		return foundSection ? SectionPrismaMapper.toSectionAggregate(foundSection) : null;
	}

	// check again
	async findOneInTheSameExamAsQuestion(id: string, questionId: string): Promise<Section | null> {
		const foundQuestion = await this.txHost.tx.question.findUnique({
			where: { id: questionId },
			select: {
				section: { select: { examId: true } },
			},
		});

		if (!foundQuestion) throw new NotFoundException(`Question id ${questionId} could not be found`);

		const foundSection = await this.txHost.tx.section.findUnique({
			where: { id: id, examId: foundQuestion.section.examId },
			include: sectionPrismaIncludeObject,
		});
		return foundSection ? SectionPrismaMapper.toSectionAggregate(foundSection) : null;
	}

	async save(section: Section): Promise<void> {
		const data = SectionPrismaMapper.toParentSectionOrm(section);
		await this.txHost.withTransaction(async () => {
			// handle events
			for (const event of section.getUncommittedEvents()) {
				await this.handle(event);
			}

			// update the main section with lock
			await this.txHost.tx.section.update({
				where: { id: data.id, exam: { id: section.examId.id, version: section.examId.version } },
				data: data,
			});

			await this.txHost.tx.exam.update({
				where: { id: section.examId.id, version: section.examId.version },
				data: { version: { increment: 1 } },
			});
		});
	}

	private async handle(event: Event<any>): Promise<void> {
		if (event instanceof QuestionCreatedEvent) return await this.onQuestionCreated(event);
		if (event instanceof QuestionMovedEvent) return await this.onQuestionMoved(event);
		if (event instanceof QuestionDeletedEvent) return await this.onQuestionDeleted(event);
		if (event instanceof ChildSectionCreatedEvent) return await this.onChildSectionCreated(event);
		if (event instanceof ChildSectionMovedEvent) return await this.onChildSectionMoved(event);
		if (event instanceof SectionDeletedEvent) return await this.onSectionDeleted(event);
		if (event instanceof SectionTagAdded) return await this.onSectionTagAdded(event);
		if (event instanceof SectionTagRemoved) return await this.onSectionTagRemoved(event);
		if (event instanceof SectionFileAdded) return await this.onSectionFileAdded(event);
		if (event instanceof SectionFileRemoved) return await this.onSectionFileRemoved(event);
	}

	private async onQuestionCreated(event: QuestionCreatedEvent): Promise<void> {
		await this.txHost.tx.question.create({
			data: SectionPrismaMapper.toChildQuestionOrm(event.payload.data, event.payload.sectionId),
		});
	}

	private async onQuestionMoved(event: QuestionMovedEvent): Promise<void> {
		await this.txHost.tx.question.update({
			where: { id: event.payload.questionId },
			data: SectionPrismaMapper.toChildQuestionOrm(event.payload.data, event.payload.sectionId),
		});
	}

	private async onQuestionDeleted(event: QuestionDeletedEvent): Promise<void> {
		await this.txHost.tx.question.delete({
			where: { id: event.payload.questionId },
		});
	}

	private async onChildSectionCreated(event: ChildSectionCreatedEvent): Promise<void> {
		await this.txHost.tx.section.create({
			data: SectionPrismaMapper.toChildSectionOrm(
				event.payload.data,
				event.payload.parentId,
				event.payload.examId.id,
			),
		});
	}

	private async onChildSectionMoved(event: ChildSectionMovedEvent): Promise<void> {
		await this.txHost.tx.section.update({
			where: { id: event.payload.sectionId },
			data: SectionPrismaMapper.toChildSectionOrm(
				event.payload.data,
				event.payload.parentId,
				event.payload.examId.id,
			),
		});
	}

	private async onSectionDeleted(event: SectionDeletedEvent): Promise<void> {
		await this.txHost.tx.section.delete({
			where: { id: event.payload.sectionId },
		});
	}

	private async onSectionTagAdded(event: SectionTagAdded): Promise<void> {
		await this.txHost.tx.sectionTag.create({
			data: {
				section: { connect: { id: event.payload.sectionId } },
				tag: { connect: { name: event.payload.tag } },
			},
		});
	}

	private async onSectionTagRemoved(event: SectionTagRemoved): Promise<void> {
		await this.txHost.tx.sectionTag.deleteMany({
			where: {
				sectionId: event.payload.sectionId,
				tag: { name: event.payload.tag },
			},
		});
	}

	private async onSectionFileAdded(event: SectionFileAdded): Promise<void> {
		await this.txHost.tx.sectionFile.create({
			data: { sectionId: event.payload.sectionId, fileId: event.payload.fileId },
		});
	}

	private async onSectionFileRemoved(event: SectionFileRemoved): Promise<void> {
		await this.txHost.tx.sectionFile.delete({
			where: {
				sectionId_fileId: { sectionId: event.payload.sectionId, fileId: event.payload.fileId },
			},
		});
	}
}

// extended section type with JOINS
type ExtendedSection = Prisma.SectionGetPayload<{
	include: typeof sectionPrismaIncludeObject;
}>;

type RepoSection = Omit<PrismaSection, 'order'>;

const sectionPrismaIncludeObject = {
	childSections: { select: { id: true, order: true }, orderBy: { order: 'asc' } },
	sectionTags: { select: { tag: { select: { name: true } } } },
	sectionFiles: { select: { fileId: true }, orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }] },
	questions: { select: { id: true, order: true }, orderBy: { order: 'asc' } },
	exam: { select: { id: true, version: true, status: true } },
} satisfies Prisma.SectionInclude;

type RepoChildSection = Pick<PrismaSection, 'id' | 'parentId' | 'examId' | 'order'>;
type RepoChildQuestion = Pick<PrismaQuestion, 'id' | 'sectionId' | 'order'>;
