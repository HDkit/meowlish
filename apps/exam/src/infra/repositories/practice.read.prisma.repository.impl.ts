import { AttemptHistorySummary } from '../../domain/read-models/practice/attempt-history-summary.read-model';
import {
	DetailedAttemptReviewData,
	SectionReviewData,
} from '../../domain/read-models/practice/attempt-review.read-model';
import {
	AttemptSavedData,
	AttemptSectionData,
} from '../../domain/read-models/practice/attempt-save-data.read-model';
import { DetailedExamInfo } from '../../domain/read-models/practice/detailed-exam.read-model';
import { DetailedQuestionInfo } from '../../domain/read-models/practice/detailed-question.read-model';
import { ExamStatistics } from '../../domain/read-models/practice/exam-statistics.read-model';
import { MinimalAttemptInfo } from '../../domain/read-models/practice/minimal-attempt.read-model';
import { MinimalExamInfo } from '../../domain/read-models/practice/minimal-exam.read-model';
import { UserStats } from '../../domain/read-models/practice/user-stats.read-model';
import { type IPracticeReadRepository } from '../../domain/repositories/practice.read.repository';
import { ExamStatus } from '../../enums/exam-status.enum';
import { QuestionType, questionTypesThatShowChoices } from '../../enums/question-type.enum';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/exam';
import { SortDirection } from '@server/typing';

@Injectable()
export class PracticeReadPrismaRepositoryImpl implements IPracticeReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	private removeDescriptionBlock(text: string): string {
		return text
			.replace(/#BEGIN_DESCRIPTION[\s\S]*?#END_DESCRIPTION/g, '')
			.replace(/\n{3,}/g, '\n\n') // clean extra newlines
			.trim();
	}

	async getUserStats(uid: string): Promise<UserStats> {
		const [baseStats] = await this.txHost.tx.$queryRaw<
			{
				attemptCounts: number;
				averageScoreInPercentage: number;
			}[]
		>(
			Prisma.sql`
      SELECT
        COUNT(*)::int AS "attemptCounts",
        AVG(
          CASE
            WHEN total_points > 0
            THEN (score::float / total_points) * 100
          END
        ) AS "averageScoreInPercentage"
      FROM attempts
      WHERE attempted_by = ${uid}
      AND ended_at IS NOT NULL
    `,
		);

		const tagInfos = await this.txHost.tx.$queryRaw<{ name: string; correctPercentage: number }[]>(
			Prisma.sql`
      SELECT
        t.name,
        AVG(
          CASE
            WHEN ar.is_correct = TRUE THEN 1
            ELSE 0
          END
        ) * 100 AS "correctPercentage"
      FROM attempt_responses ar
      JOIN questions q
        ON q.id = ar.question_id
      JOIN question_tags qt
        ON qt.question_id = q.id
      JOIN tags t
        ON t.id = qt.tag_id
      JOIN attempts a
        ON a.id = ar.attempt_id
      WHERE a.attempted_by = ${uid}
      GROUP BY t.name
    `,
		);

		return {
			attemptCounts: Number(baseStats?.attemptCounts ?? 0),
			averageScoreInPercentage: Number(baseStats?.averageScoreInPercentage ?? 0),
			tagInfos: tagInfos.map(t => ({ ...t, correctPercentage: Number(t.correctPercentage) })),
		};
	}

	async getUsersAttemptSummary(
		uid: string,
		range?: { from: Date; to: Date },
	): Promise<AttemptHistorySummary> {
		const now = new Date();
		const defaultFrom = new Date(now.getFullYear(), 0, 1); // Jan 1st
		const defaultTo = now;

		const from = range?.from ?? defaultFrom;
		const to = range?.to ?? defaultTo;

		const rows = await this.txHost.tx.$queryRaw<{ day: bigint; count: number }[]>`
      SELECT
        EXTRACT(EPOCH FROM DATE_TRUNC('day', ended_at))::bigint AS day,
        COUNT(*)::int AS count
      FROM attempts
      WHERE attempted_by = ${uid}
        AND ended_at IS NOT NULL
        AND ended_at >= ${from}
        AND ended_at <= ${to}
      GROUP BY day
      ORDER BY day
    `;

		const summary: AttemptHistorySummary = {};
		for (const row of rows) {
			summary[Number(row.day)] = row.count;
		}

		return summary;
	}

	async getUsersAttemptHistory(
		uid: string,
		options?: {
			examId?: string;
			sortBy?: {
				key: 'endedAt' | 'startedAt' | 'examId' | 'score';
				direction: SortDirection;
			};
			lastId?: string;
			limit?: number;
		},
	): Promise<MinimalAttemptInfo[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');

		const foundHistory = await this.txHost.tx.attempt.findMany({
			where: { attemptedBy: uid, ...(options?.examId ? { examId: options.examId } : {}) },
			select: {
				id: true,
				startedAt: true,
				endedAt: true,
				durationLimit: true,
				score: true,
				totalPoints: true,
				isStrict: true,
			},
			orderBy: [
				// those who TS
				...(options?.sortBy ?
					[{ [options.sortBy.key]: options.sortBy.direction.toLowerCase() }]
				:	[]),
				{ id: 'asc' },
			],
			take: options?.limit ?? 10,
			...(options?.lastId && {
				cursor: { id: options.lastId },
				skip: 1,
			}),
		});

		return foundHistory.map(a => ({
			...a,
			endedAt: a.endedAt ?? undefined,
			score: a.score ?? undefined,
			totalPoints: a.totalPoints ?? undefined,
		}));
	}

	async findExams(options?: {
		filter?: { name?: string; tags?: string[] };
		sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
		lastCursor?: {
			id: string;
			attemptsCount?: number;
			updatedAt?: Date;
		};
		limit?: number;
	}): Promise<MinimalExamInfo[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');

		// sort by attemptsCount or by update time
		// fallback to sort by ID
		const sortSql =
			options?.sortBy ?
				options.sortBy.key === 'attemptsCount' ?
					Prisma.sql`
          "attemptsCount" ${Prisma.raw(options.sortBy.direction)},
          e.id ASC
        `
				:	Prisma.sql`
          e.updated_at ${Prisma.raw(options.sortBy.direction)},
          e.id ASC
        `
			:	Prisma.sql`e.id ASC`;

		// filter by name
		const nameFilterSql =
			options?.filter?.name ?
				Prisma.sql`
        e.title ILIKE '%' || ${options.filter.name} || '%'
      `
				// fallback take all
			:	Prisma.sql`TRUE`;

		// filter by tag (any tags in exam, sections or questions)
		const tagFilterSql =
			options?.filter?.tags?.length ?
				Prisma.sql`

        EXISTS (

          SELECT 1
          FROM tags filter_t

          WHERE filter_t.name IN (
            ${Prisma.join(options.filter.tags)}
          )

          AND EXISTS (

            SELECT 1
            FROM tags t2

            LEFT JOIN exam_tags et2
              ON et2.tag_id = t2.id

            LEFT JOIN section_tags st2
              ON st2.tag_id = t2.id

            LEFT JOIN sections s
              ON s.id = st2.section_id

            LEFT JOIN question_tags qt2
              ON qt2.tag_id = t2.id

            LEFT JOIN questions q
              ON q.id = qt2.question_id

            LEFT JOIN sections qs
              ON qs.id = q.section_id

            WHERE

              (
                et2.exam_id = e.id
                OR s.exam_id = e.id
                OR qs.exam_id = e.id
              )

              -- the filter must be descendants of the tags inside exam (sections, questions and whatnot)
              AND filter_t.lft BETWEEN t2.lft AND t2.rgt

          )

        )

      `
				// fallback take all
			:	Prisma.sql`TRUE`;

		const cursorWhereSql =
			// updatedAt cursor when ASC updatedAt
			(
				options?.sortBy?.key === 'updatedAt' &&
				options.sortBy.direction === SortDirection.ASC &&
				options?.lastCursor?.updatedAt
			) ?
				Prisma.sql`
      (
        e.updated_at,
        e.id
      ) > (
        ${options.lastCursor.updatedAt},
        ${options.lastCursor.id}
      )
    `
				// updatedAt cursor when DESC updatedAt
			: (
				options?.sortBy?.key === 'updatedAt' &&
				options.sortBy.direction === SortDirection.DESC &&
				options.lastCursor?.updatedAt
			) ?
				Prisma.sql`
        e.updated_at < ${options.lastCursor.updatedAt}
        OR (
        e.updated_at = ${options.lastCursor.updatedAt}
        AND e.id > ${options.lastCursor.id}
      )
    `
				// id cursor
			: !options?.sortBy && options?.lastCursor?.id ?
				Prisma.sql`
      e.id > ${options.lastCursor.id}
    `
			:	Prisma.sql`TRUE`;

		const cursorHavingSql =
			// attemptsCount cursor when ASC attemptsCount
			(
				options?.sortBy?.key === 'attemptsCount' &&
				options.sortBy.direction === SortDirection.ASC &&
				options?.lastCursor?.attemptsCount !== undefined
			) ?
				Prisma.sql`
      (
        COUNT(DISTINCT a.id),
        e.id
      ) > (
        ${options.lastCursor.attemptsCount},
        ${options.lastCursor.id}
      )
    `
				// attemptsCount cursor when DESC attemptsCount
			: (
				options?.sortBy?.key === 'attemptsCount' &&
				options.sortBy.direction === SortDirection.DESC &&
				options?.lastCursor?.attemptsCount !== undefined
			) ?
				Prisma.sql`
        COUNT(DISTINCT a.id) < ${options.lastCursor.attemptsCount}
        OR (
        COUNT(DISTINCT a.id) = ${options.lastCursor.attemptsCount}
        AND e.id > ${options.lastCursor.id}
      )
    `
			:	Prisma.sql`TRUE`;

		const rows = await this.txHost.tx.$queryRaw<
			{
				id: string;
				name: string;
				description: string | null;
				attemptsCount: number;
				duration: number;
				updatedAt: Date;
				tags: string[];
			}[]
		>(
			Prisma.sql`

      SELECT
        e.id,
        e.title AS name,
        e.description,
        e.duration,
        e.updated_at AS "updatedAt",
        -- cast type to int, count distinct because join causes duplicate
        COUNT(DISTINCT a.id)::int AS "attemptsCount",
        -- return tags from exam directly
        COALESCE(
          ARRAY_AGG(DISTINCT t.name)
            FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags

      FROM exams e

      LEFT JOIN attempts a
        ON a.exam_id = e.id

      LEFT JOIN exam_tags et
        ON et.exam_id = e.id

      LEFT JOIN tags t
        ON t.id = et.tag_id

      WHERE
        e.status = ${ExamStatus.Approved}
        AND ${nameFilterSql}
        AND ${tagFilterSql}
        AND ${cursorWhereSql}

      GROUP BY e.id

      HAVING
        ${cursorHavingSql}

      ORDER BY ${sortSql}

      LIMIT ${options?.limit ?? 10}
    `,
		);

		return rows.map(r => ({ ...r, description: r.description ?? undefined }));
	}

	async getExamDetail(examId: string): Promise<DetailedExamInfo | null> {
		const [exam] = await this.txHost.tx.$queryRaw<
			{
				id: string;
				name: string;
				description: string | null;
				duration: number;
				updatedAt: Date;
				attemptsCount: number;
				tags: string[];
			}[]
		>(
			Prisma.sql`
      SELECT
        e.id,
        e.title AS name,
        e.description,
        e.duration,
        e.updated_at AS "updatedAt",
        COUNT(DISTINCT a.id)::int AS "attemptsCount",
        COALESCE(
          ARRAY_AGG(DISTINCT t.name)
            FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags

      FROM exams e

      LEFT JOIN attempts a
        ON a.exam_id = e.id

      LEFT JOIN exam_tags et
        ON et.exam_id = e.id

      LEFT JOIN tags t
        ON t.id = et.tag_id

      WHERE e.status = ${ExamStatus.Approved}
      AND e.id = ${examId}

      GROUP BY e.id
    `,
		);

		if (!exam) return null;

		const sections = await this.txHost.tx.$queryRaw<
			{
				id: string;
				name: string | null;
				questionsCount: number;
				tags: string[];
			}[]
		>(
			Prisma.sql`
      SELECT
        s.id,
        s.name,

        COUNT(DISTINCT q.id)::int AS "questionsCount",

        COALESCE(
          ARRAY_AGG(DISTINCT tag_names.name)
            FILTER (WHERE tag_names.name IS NOT NULL),
          '{}'
        ) AS tags

      FROM sections s

      /* get descendants */
      LEFT JOIN section_closures sc
        ON sc.ancestor_id = s.id

      /* questions inside descendants */
      LEFT JOIN questions q
        ON q.section_id = sc.descendant_id

      /* section tags from descendants */
      LEFT JOIN section_tags st
        ON st.section_id = sc.descendant_id

      /* question tags */
      LEFT JOIN question_tags qt
        ON qt.question_id = q.id

      /* unify tag sources */
      LEFT JOIN tags tag_names
        ON tag_names.id = st.tag_id
        OR tag_names.id = qt.tag_id

      WHERE s.exam_id = ${examId}
        AND s.parent_id IS NULL

      GROUP BY s.id

      ORDER BY s.order ASC
      `,
		);

		return {
			id: exam.id,
			name: exam.name,
			description: exam.description ?? undefined,
			duration: exam.duration,
			updatedAt: exam.updatedAt,
			attemptsCount: exam.attemptsCount,
			tags: exam.tags,
			sections: sections.map(s => ({ ...s, name: s.name ?? undefined })),
		};
	}

	async getExamStats(examId: string): Promise<ExamStatistics | null> {
		const exam = await this.txHost.tx.exam.findUnique({
			where: { id: examId, status: ExamStatus.Approved },
		});
		if (!exam) return null;

		const [stats] = await this.txHost.tx.$queryRaw<
			{
				averageDuration: number;
				averageScoreInPercentage: number;
			}[]
		>(
			Prisma.sql`
      SELECT
        AVG(
          EXTRACT(EPOCH FROM (ended_at - started_at))
        ) AS "averageDuration", -- in seconds

        AVG(
          CASE
            WHEN total_points > 0
            THEN score::float / total_points * 100
          END
        ) AS "averageScoreInPercentage"

      FROM attempts
      WHERE exam_id = ${examId}
      AND ended_at IS NOT NULL
    `,
		);

		const questions = await this.txHost.tx.$queryRaw<
			{
				id: string;
				correctCount: number;
				totalCount: number;
				tags: string[];
			}[]
		>(
			Prisma.sql`
        SELECT
          q.id,

          COUNT(DISTINCT ar.id)
            FILTER (WHERE ar.is_correct = TRUE)::int
            AS "correctCount",

          COUNT(DISTINCT ar.id)
            FILTER (WHERE ar.answers IS NOT NULL AND cardinality(ar.answers) > 0)::int
            AS "totalCount",

          COALESCE(
            ARRAY_AGG(DISTINCT tag_names.name)
              FILTER (WHERE tag_names.name IS NOT NULL),
            '{}'
          ) AS tags

        FROM questions q

        LEFT JOIN attempt_responses ar
          ON ar.question_id = q.id

        JOIN sections s
          ON s.id = q.section_id

        LEFT JOIN question_tags qt
          ON qt.question_id = q.id

        LEFT JOIN tags tag_names
          ON tag_names.id = qt.tag_id

        WHERE s.exam_id = ${examId}

        GROUP BY q.id
      `,
		);

		return {
			averageDuration: Number(stats?.averageDuration ?? 0),
			averageScoreInPercentage: Number(stats?.averageScoreInPercentage ?? 0),
			questions: questions,
		};
	}

	async getAttemptSavedData(attemptId: string): Promise<AttemptSavedData | null> {
		const attemptData = await this.txHost.tx.attempt.findUnique({
			where: { id: attemptId, endedAt: null },
			select: {
				examId: true,
				startedAt: true,
				durationLimit: true,
				attemptResponses: {
					select: { questionId: true, answers: true, note: true, isFlagged: true },
				},
			},
		});

		if (!attemptData) return null;

		const sections = await this.txHost.tx.attemptSection.findMany({
			where: { attemptId: attemptId },
			select: {
				section: {
					select: {
						descendants: {
							select: {
								descendant: {
									select: {
										id: true,
										parentId: true,
										name: true,
										directive: true,
										order: true,
										contentType: true,
										sectionFiles: {
											select: { fileId: true },
											orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
										},
										questions: {
											select: {
												id: true,
												content: true,
												type: true,
												order: true,
												questionFiles: {
													select: { fileId: true },
													orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
												},
												choices: { select: { key: true, content: true } },
											},
											orderBy: { order: 'asc' },
										},
									},
								},
							},
						},
					},
				},
			},
		});

		const flattenedSections =
			sections.length === 0 ?
				await this.txHost.tx.section.findMany({
					where: { examId: attemptData.examId },
					select: {
						id: true,
						parentId: true,
						name: true,
						directive: true,
						order: true,
						contentType: true,
						sectionFiles: {
							select: { fileId: true },
							orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
						},
						questions: {
							select: {
								id: true,
								content: true,
								type: true,
								order: true,
								questionFiles: {
									select: { fileId: true },
									orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
								},
								choices: { select: { key: true, content: true } },
							},
							orderBy: { order: 'asc' },
						},
					},
				})
			:	sections.map(s => s.section.descendants.map(d => d.descendant)).flat();

		const castedFlattenedSections: (AttemptSectionData & { parentId: string | null })[] =
			flattenedSections.map(s => ({
				id: s.id,
				parentId: s.parentId,
				name: s.name ?? undefined,
				directive: s.directive,
				order: s.order,
				fileUrls: s.sectionFiles.map(f => f.fileId),
				type: s.contentType,
				sections: [],
				questions: s.questions.map(q => ({
					id: q.id,
					order: q.order,
					content:
						q.type === String(QuestionType.Writing) ?
							this.removeDescriptionBlock(q.content)
						:	q.content,
					type: q.type,
					fileUrls: q.questionFiles.map(f => f.fileId),
					choices:
						questionTypesThatShowChoices.includes(q.type as QuestionType) ?
							q.choices.map(c => ({ key: c.key, content: c.content ?? undefined }))
						:	[],
				})),
			}));
		const sectionsMap = new Map(castedFlattenedSections.map(s => [s.id, s]));
		const treeSections = castedFlattenedSections
			.filter(s => {
				if (s.parentId === null) return true;
				const section = sectionsMap.get(s.parentId);
				if (!section) throw new Error('Problem when building section trees');
				section.sections.push(s);
				section.sections.sort((s1, s2) => s1.order - s2.order);
				return false;
			})
			.sort((s1, s2) => s1.order - s2.order);

		return {
			startedAt: attemptData.startedAt,
			durationLimit: attemptData.durationLimit,
			responses: attemptData.attemptResponses.map(r => ({
				questionId: r.questionId,
				note: r.note ?? undefined,
				isFlagged: r.isFlagged,
				answers: r.answers,
			})),
			sections: treeSections,
		};
	}

	async getAttemptReview(attemptId: string): Promise<DetailedAttemptReviewData | null> {
		const attemptData = await this.txHost.tx.attempt.findUnique({
			where: { id: attemptId, endedAt: { not: null } },
			select: {
				examId: true,
				startedAt: true,
				endedAt: true,
				durationLimit: true,
				attemptResponses: {
					select: {
						questionId: true,
						answers: true,
						note: true,
						isFlagged: true,
						scorerDatas: { select: { comment: true } },
						isCorrect: true,
					},
				},
				totalPoints: true,
			},
		});

		if (!attemptData) return null;

		const sections = await this.txHost.tx.attemptSection.findMany({
			where: { attemptId: attemptId },
			select: {
				section: {
					select: {
						descendants: {
							select: {
								descendant: {
									select: {
										id: true,
										parentId: true,
										name: true,
										directive: true,
										order: true,
										contentType: true,
										sectionFiles: {
											select: { fileId: true },
											orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
										},
										questions: {
											select: {
												id: true,
												content: true,
												type: true,
												order: true,
												questionFiles: {
													select: { fileId: true },
													orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
												},
												choices: { select: { key: true, content: true, isCorrect: true } },
												questionTags: { select: { tag: { select: { name: true } } } },
												points: true,
											},
											orderBy: { order: 'asc' },
										},
									},
								},
							},
						},
					},
				},
			},
		});

		const flattenedSections =
			sections.length === 0 ?
				await this.txHost.tx.section.findMany({
					where: { examId: attemptData.examId },
					select: {
						id: true,
						parentId: true,
						name: true,
						directive: true,
						order: true,
						contentType: true,
						sectionFiles: {
							select: { fileId: true },
							orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
						},
						questions: {
							select: {
								id: true,
								content: true,
								type: true,
								order: true,
								questionFiles: {
									select: { fileId: true },
									orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
								},
								choices: { select: { key: true, content: true, isCorrect: true } },
								questionTags: { select: { tag: { select: { name: true } } } },
								points: true,
							},
							orderBy: { order: 'asc' },
						},
					},
				})
			:	sections.map(s => s.section.descendants.map(d => d.descendant)).flat();

		const castedFlattenedSections: (SectionReviewData & { parentId: string | null })[] =
			flattenedSections.map(s => ({
				id: s.id,
				parentId: s.parentId,
				name: s.name ?? undefined,
				directive: s.directive,
				order: s.order,
				fileUrls: s.sectionFiles.map(f => f.fileId),
				type: s.contentType,
				sections: [],
				questions: s.questions.map(q => ({
					id: q.id,
					order: q.order,
					content:
						q.type === String(QuestionType.Writing) ?
							this.removeDescriptionBlock(q.content)
						:	q.content,
					type: q.type,
					fileUrls: q.questionFiles.map(f => f.fileId),
					points: q.points,
					choices: q.choices.map(c => ({
						key: c.key,
						content: c.content ?? undefined,
						isCorrect: c.isCorrect,
					})),
					tags: q.questionTags.map(t => t.tag.name),
				})),
			}));
		const sectionsMap = new Map(castedFlattenedSections.map(s => [s.id, s]));
		const treeSections = castedFlattenedSections
			.filter(s => {
				if (s.parentId === null) return true;
				const section = sectionsMap.get(s.parentId);
				if (!section) throw new Error('Problem when building section trees');
				section.sections.push(s);
				section.sections.sort((s1, s2) => s1.order - s2.order);
				return false;
			})
			.sort((s1, s2) => s1.order - s2.order);

		return {
			startedAt: attemptData.startedAt,
			endedAt: attemptData.endedAt as Date,
			durationLimit: attemptData.durationLimit,
			totalPoints: attemptData.totalPoints ?? undefined,
			responses: attemptData.attemptResponses.map(r => ({
				questionId: r.questionId,
				note: r.note ?? undefined,
				isFlagged: r.isFlagged,
				answers: r.answers,
				isCorrect: r.isCorrect ?? undefined,
				additionalData: r.scorerDatas.length ? JSON.stringify(r.scorerDatas[0].comment) : undefined,
			})),
			sections: treeSections,
		};
	}

	async getDetailedQuestionInfo(questionId: string): Promise<DetailedQuestionInfo | null> {
		const foundQuestion = await this.txHost.tx.question.findUnique({
			where: { id: questionId, section: { exam: { status: ExamStatus.Approved } } },
			select: {
				id: true,
				content: true,
				type: true,
				explanation: true,
				points: true,
				questionFiles: {
					select: { fileId: true },
					orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
				},
				section: {
					select: {
						ancestors: {
							select: {
								ancestor: {
									select: {
										directive: true,
										sectionFiles: {
											select: { fileId: true },
											orderBy: [{ updatedAt: 'asc' }, { fileId: 'asc' }],
										},
									},
								},
							},
							orderBy: [{ depth: 'desc' }],
						},
					},
				},
			},
		});

		if (!foundQuestion) return null;

		if (foundQuestion.type === String(QuestionType.Writing))
			foundQuestion.content = this.removeDescriptionBlock(foundQuestion.content);

		return {
			id: foundQuestion.id,
			content: foundQuestion.content,
			explanation: foundQuestion.explanation,
			points: foundQuestion.points,
			type: foundQuestion.type,
			fileUrls: foundQuestion.questionFiles.map(f => f.fileId),
			sectionContext: foundQuestion.section.ancestors.map(a => ({
				content: a.ancestor.directive ?? undefined,
				fileUrls: a.ancestor.sectionFiles.map(f => f.fileId),
			})),
		};
	}
}
