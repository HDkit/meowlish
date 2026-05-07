import {
	ExamManagementDetailedInfo,
	ExamManagementMinimalInfo,
} from '../../domain/read-models/management/exam-info.read-model';
import { QuestionManagementInfo } from '../../domain/read-models/management/question-info.read-model';
import { SectionManagementInfo } from '../../domain/read-models/management/section-info.read-model';
import { IManagementReadRepository } from '../../domain/repositories/management.read.repository';
import { ExamStatus } from '../../enums/exam-status.enum';
import { SectionType } from '../../enums/section-type.enum';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/exam';
import { SortDirection } from '@server/typing';

@Injectable()
export class ManagementPrismaRepositoryImpl implements IManagementReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async findExams(options?: {
		filter?: {
			title?: string;
			createdBy?: string;
			status?: ExamStatus;
			createdTimeRange?: { from: Date; to: Date };
			updatedTimeRange?: { from: Date; to: Date };
		};
		sortBy?: { key: 'updatedAt' | 'createdAt'; direction: SortDirection };
		lastId?: string;
		limit?: number;
	}): Promise<ExamManagementMinimalInfo[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const filter = options?.filter;

		const foundExams = await this.txHost.tx.exam.findMany({
			where: {
				...(filter?.title && { title: filter.title }),
				...(filter?.createdBy && { createdBy: filter?.createdBy }),
				...(filter?.status && { status: filter?.status }),
				...(filter?.createdTimeRange && {
					createdAt: { gt: filter.createdTimeRange.from, lt: filter.createdTimeRange.to },
				}),
				...(filter?.updatedTimeRange && {
					createdAt: { gt: filter.updatedTimeRange.from, lt: filter.updatedTimeRange.to },
				}),
			},
			select: {
				id: true,
				createdAt: true,
				createdBy: true,
				updatedAt: true,
				title: true,
				status: true,
			},
			orderBy: [
				...(options?.sortBy ?
					[{ [options.sortBy.key]: options.sortBy.direction.toLowerCase() }]
				:	[]),
				{ id: 'asc' },
			],
			...(options?.lastId && {
				cursor: { id: options.lastId },
				skip: 1,
			}),
			take: options?.limit ?? 10,
		});
		return foundExams;
	}

	async getExamDetail(examId: string): Promise<ExamManagementDetailedInfo | null> {
		const foundExam = await this.txHost.tx.exam.findUnique({
			where: { id: examId },
			select: {
				id: true,
				createdAt: true,
				createdBy: true,
				updatedAt: true,
				title: true,
				status: true,
				description: true,
				duration: true,
				sections: {
					where: { parentId: null },
					select: { id: true },
					orderBy: [{ order: 'asc' }],
				},
				examTags: { select: { tag: { select: { name: true } } } },
			},
		});

		if (!foundExam) return null;

		return {
			...foundExam,
			description: foundExam.description ?? undefined,
			sectionIds: foundExam.sections.map(s => s.id),
			tags: foundExam.examTags.map(t => t.tag.name),
		};
	}

	async getSectionDetail(sectionId: string): Promise<SectionManagementInfo | null> {
		const foundSection = await this.txHost.tx.section.findUnique({
			where: { id: sectionId },
			select: {
				id: true,
				examId: true,
				parentId: true,
				name: true,
				directive: true,
				contentType: true,
				questions: { select: { id: true }, orderBy: [{ order: 'asc' }] },
				childSections: { select: { id: true }, orderBy: [{ order: 'asc' }] },
				sectionFiles: { select: { fileId: true }, orderBy: [{ updatedAt: 'asc' }] },
				sectionTags: { select: { tag: { select: { name: true } } } },
			},
		});

		if (!foundSection) return null;

		return {
			...foundSection,
			name: foundSection.name ?? undefined,
			parentId: foundSection.parentId ?? undefined,
			childrenIds:
				foundSection.contentType === String(SectionType.Question) ?
					foundSection.questions.map(q => q.id)
				:	foundSection.childSections.map(q => q.id),
			files: foundSection.sectionFiles.map(f => ({ id: f.fileId })),
			tags: foundSection.sectionTags.map(t => t.tag.name),
		};
	}

	async getQuestionDetail(questionId: string): Promise<QuestionManagementInfo | null> {
		const foundQuestion = await this.txHost.tx.question.findUnique({
			where: { id: questionId },
			select: {
				id: true,
				sectionId: true,
				content: true,
				type: true,
				points: true,
				explanation: true,
				choices: {
					select: { id: true, questionId: true, key: true, content: true, isCorrect: true },
				},
				questionFiles: { select: { fileId: true }, orderBy: [{ updatedAt: 'asc' }] },
				questionTags: { select: { tag: { select: { name: true } } } },
			},
		});

		if (!foundQuestion) return null;

		return {
			...foundQuestion,
			choices: foundQuestion.choices.map(c => ({ ...c, content: c.content ?? undefined })),
			files: foundQuestion.questionFiles.map(f => ({ id: f.fileId })),
			tags: foundQuestion.questionTags.map(t => t.tag.name),
		};
	}
}
