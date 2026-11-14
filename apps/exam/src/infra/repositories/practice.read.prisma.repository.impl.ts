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
import { ActivityDayRow } from '../../domain/read-models/practice/user-activity.read-model';
import {
	SkillStatsAttemptRow,
	SkillStatsObjectiveRow,
	SkillStatsSource,
	SkillStatsWritingRow,
	TagAccuracy,
} from '../../domain/read-models/practice/user-skill-stats.read-model';
import { UserStats } from '../../domain/read-models/practice/user-stats.read-model';
import { type IPracticeReadRepository } from '../../domain/repositories/practice.read.repository';
import { ExamStatus } from '../../enums/exam-status.enum';
import { QuestionType, questionTypesThatShowChoices } from '../../enums/question-type.enum';
import { Skill } from '../../enums/skill.enum';
import { toWritingBand } from './writing-band';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/exam';
import { SortDirection } from '@server/typing';

/** Longest stretch one attempt counts towards practice time (3 h), whatever its limit says. */
const maxPracticeSecondsPerAttempt = 3 * 60 * 60;

/** Tags whose own or an ancestor's name mentions a skill as a whole word, mapped to that skill. */
const tagSkillsCte = Prisma.sql`
	tag_skills AS (
		SELECT DISTINCT tag_id, skill FROM (
			SELECT t.id AS tag_id,
				CASE
					WHEN anc.name ~* ${'\\mlistening\\M'} THEN ${Skill.Listening}
					WHEN anc.name ~* ${'\\mreading\\M'} THEN ${Skill.Reading}
					WHEN anc.name ~* ${'\\mwriting\\M'} THEN ${Skill.Writing}
					WHEN anc.name ~* ${'\\mspeaking\\M'} THEN ${Skill.Speaking}
				END AS skill
			FROM tags t
			JOIN tags anc ON anc.lft <= t.lft AND anc.rgt >= t.rgt
		) named
		WHERE skill IS NOT NULL
	)`;

/**
 * The questions each attempt covered: those under the sections it picked, or the whole exam when
 * it picked none (the same rule the attempt aggregate uses). Writing questions or the others.
 */
function attemptQuestionsCte(attemptIds: string[], writing: boolean): Prisma.Sql {
	const typeFilter =
		writing ?
			Prisma.sql`q.type = ${QuestionType.Writing}`
		:	Prisma.sql`q.type <> ${QuestionType.Writing}`;
	return Prisma.sql`
	aq AS (
		SELECT a.id AS attempt_id, q.id AS question_id, q.section_id
		FROM attempts a
		JOIN attempt_sections ats ON ats.attempt_id = a.id
		JOIN section_closures sc ON sc.ancestor_id = ats.section_id
		JOIN questions q ON q.section_id = sc.descendant_id AND ${typeFilter}
		WHERE a.id IN (${Prisma.join(attemptIds)})
		UNION
		SELECT a.id, q.id, q.section_id
		FROM attempts a
		JOIN sections s ON s.exam_id = a.exam_id
		JOIN questions q ON q.section_id = s.id AND ${typeFilter}
		WHERE a.id IN (${Prisma.join(attemptIds)})
			AND NOT EXISTS (SELECT 1 FROM attempt_sections x WHERE x.attempt_id = a.id)
	)`;
}

/** Each covered objective question with its outcome: correct, answered wrong, or skipped. */
const outcomeCte = Prisma.sql`
	outcome AS (
		SELECT aq.attempt_id, aq.question_id, aq.section_id,
			CASE
				WHEN ar.is_correct IS TRUE THEN 'correct'
				WHEN ar.id IS NOT NULL AND cardinality(ar.answers) > 0 THEN 'incorrect'
				ELSE 'skipped'
			END AS outcome
		FROM aq
		LEFT JOIN attempt_responses ar
			ON ar.attempt_id = aq.attempt_id AND ar.question_id = aq.question_id
	)`;

const outcomeCounts = Prisma.sql`
	COUNT(*) FILTER (WHERE o.outcome = 'correct')::int AS correct,
	COUNT(*) FILTER (WHERE o.outcome = 'incorrect')::int AS incorrect,
	COUNT(*) FILTER (WHERE o.outcome = 'skipped')::int AS skipped`;

@Injectable()
export class PracticeReadPrismaRepositoryImpl implements IPracticeReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getAttemptOwner(attemptId: string): Promise<string | null> {
		const attempt = await this.txHost.tx.attempt.findUnique({
			where: { id: attemptId },
			select: { attemptedBy: true },
		});
		return attempt?.attemptedBy ?? null;
	}

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

	async getUserActivityDays(uid: string): Promise<ActivityDayRow[]> {
		const rows = await this.txHost.tx.$queryRaw<
			{ date: string; attempts: number; seconds: number }[]
		>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', ended_at), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS attempts,
        COALESCE(SUM(LEAST(
          GREATEST(EXTRACT(EPOCH FROM (ended_at - started_at)), 0),
          CASE WHEN duration_limit > 0 THEN duration_limit ELSE ${maxPracticeSecondsPerAttempt} END,
          ${maxPracticeSecondsPerAttempt}
        )), 0)::float AS seconds
      FROM attempts
      WHERE attempted_by = ${uid}
        AND ended_at IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `;
		return rows.map(r => ({
			date: r.date,
			attempts: Number(r.attempts),
			seconds: Number(r.seconds),
		}));
	}

	async getUserSkillStatsSource(uid: string, limit: number): Promise<SkillStatsSource> {
		const recent = await this.txHost.tx.attempt.findMany({
			where: { attemptedBy: uid, endedAt: { not: null } },
			orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
			take: limit,
			select: { id: true, examId: true, endedAt: true, exam: { select: { title: true } } },
		});
		if (recent.length === 0) return { attempts: [], objective: [], writing: [], tags: [] };

		const attemptIds = recent.map(a => a.id);
		const examIds = [...new Set(recent.map(a => a.examId))];

		const examSkills = await this.txHost.tx.$queryRaw<
			{ examId: string; examSkills: string[]; claimedSkills: string[] }[]
		>(Prisma.sql`
      WITH ${tagSkillsCte}
      SELECT
        e.id AS "examId",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT ts.skill)
          FROM exam_tags et JOIN tag_skills ts ON ts.tag_id = et.tag_id
          WHERE et.exam_id = e.id
        ), '{}') AS "examSkills",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT ts.skill)
          FROM sections s
          JOIN section_tags st ON st.section_id = s.id
          JOIN tag_skills ts ON ts.tag_id = st.tag_id
          WHERE s.exam_id = e.id
        ), '{}') AS "claimedSkills"
      FROM exams e
      WHERE e.id IN (${Prisma.join(examIds)})
    `);
		const skillsByExam = new Map(examSkills.map(e => [e.examId, e]));

		const objective = await this.txHost.tx.$queryRaw<SkillStatsObjectiveRow[]>(Prisma.sql`
      WITH ${tagSkillsCte}, ${attemptQuestionsCte(attemptIds, false)}, ${outcomeCte},
      qs AS (
        SELECT qt.question_id, ARRAY_AGG(DISTINCT ts.skill ORDER BY ts.skill) AS skills
        FROM question_tags qt JOIN tag_skills ts ON ts.tag_id = qt.tag_id
        WHERE qt.question_id IN (SELECT question_id FROM aq)
        GROUP BY qt.question_id
      ),
      ss AS (
        SELECT sc.descendant_id AS section_id, ARRAY_AGG(DISTINCT ts.skill ORDER BY ts.skill) AS skills
        FROM section_closures sc
        JOIN section_tags st ON st.section_id = sc.ancestor_id
        JOIN tag_skills ts ON ts.tag_id = st.tag_id
        WHERE sc.descendant_id IN (SELECT section_id FROM aq)
        GROUP BY sc.descendant_id
      )
      SELECT
        o.attempt_id AS "attemptId",
        COALESCE(qs.skills, '{}') AS "questionSkills",
        COALESCE(ss.skills, '{}') AS "sectionSkills",
        ${outcomeCounts}
      FROM outcome o
      LEFT JOIN qs ON qs.question_id = o.question_id
      LEFT JOIN ss ON ss.section_id = o.section_id
      GROUP BY o.attempt_id, qs.skills, ss.skills
    `);

		const writing = await this.txHost.tx.$queryRaw<
			{ attemptId: string; answered: boolean; comment: Prisma.JsonValue | null }[]
		>(Prisma.sql`
      WITH ${attemptQuestionsCte(attemptIds, true)}
      SELECT
        aq.attempt_id AS "attemptId",
        (ar.id IS NOT NULL AND cardinality(ar.answers) > 0) AS answered,
        sd.comment
      FROM aq
      LEFT JOIN attempt_responses ar
        ON ar.attempt_id = aq.attempt_id AND ar.question_id = aq.question_id
      LEFT JOIN scorer_data sd ON sd.response_id = ar.id
    `);

		const tags = await this.txHost.tx.$queryRaw<TagAccuracy[]>(Prisma.sql`
      WITH ${attemptQuestionsCte(attemptIds, false)}, ${outcomeCte}
      SELECT t.name, ${outcomeCounts}
      FROM outcome o
      JOIN question_tags qt ON qt.question_id = o.question_id
      JOIN tags t ON t.id = qt.tag_id
      GROUP BY t.name
    `);

		const attempts: SkillStatsAttemptRow[] = recent.map(a => ({
			attemptId: a.id,
			examTitle: a.exam.title,
			endedAt: a.endedAt ?? new Date(0),
			examSkills: skillsByExam.get(a.examId)?.examSkills ?? [],
			claimedSkills: skillsByExam.get(a.examId)?.claimedSkills ?? [],
		}));
		const writingRows: SkillStatsWritingRow[] = writing.map(w => ({
			attemptId: w.attemptId,
			answered: w.answered,
			band: w.comment === null ? null : toWritingBand([{ comment: w.comment }]),
		}));
		const counts = (r: { correct: number; incorrect: number; skipped: number }) => ({
			correct: Number(r.correct),
			incorrect: Number(r.incorrect),
			skipped: Number(r.skipped),
		});
		return {
			attempts: attempts,
			objective: objective.map(o => ({
				attemptId: o.attemptId,
				questionSkills: o.questionSkills,
				sectionSkills: o.sectionSkills,
				...counts(o),
			})),
			writing: writingRows,
			tags: tags.map(t => ({ name: t.name, ...counts(t) })),
		};
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
			direction?: number;
		},
	): Promise<MinimalAttemptInfo[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const limit = options?.limit ?? 10;
		const dir = Math.sign(options?.direction || 1);

		const foundHistory = await this.txHost.tx.attempt.findMany({
			where: { attemptedBy: uid, ...(options?.examId ? { examId: options.examId } : {}) },
			select: {
				id: true,
				exam: {
					select: {
						id: true,
						title: true,
					},
				},
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
			take: dir * limit,
			...(options?.lastId && {
				cursor: { id: options.lastId },
				skip: 1,
			}),
		});

		return foundHistory.map(a => ({
			...a,
			examId: a.exam.id,
			examName: a.exam.title,
			endedAt: a.endedAt ?? undefined,
			score: a.score ?? undefined,
			totalPoints: a.totalPoints ?? undefined,
		}));
	}

	async findExams(options?: {
		filter?: { name?: string; tags?: string[]; requiredTags?: string[] };
		sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
		lastCursor?: {
			id: string;
			attemptsCount?: number;
			updatedAt?: Date;
		};
		limit?: number;
		direction?: number;
		/** 1-based page: OFFSET pagination; `lastCursor`/`direction` are ignored. */
		page?: number;
	}): Promise<MinimalExamInfo[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const dir = Math.sign(options?.direction || 1);
		const isForward = dir === 1;
		// A backward page is the `limit` rows just before the cursor: query them in reverse order,
		// then flip the rows back (below), so the id tie-breaker and the sort key both reverse.
		const idOrder = isForward ? 'ASC' : 'DESC';
		// Never interpolate the caller's value into raw SQL: it can come from a decoded cursor.
		const isAscending = options?.sortBy?.direction === SortDirection.ASC;
		const sortOrder = isAscending === isForward ? 'ASC' : 'DESC';

		// sort by attemptsCount or by update time
		// fallback to sort by ID
		const sortSql =
			options?.sortBy ?
				options.sortBy.key === 'attemptsCount' ?
					Prisma.sql`
          "attemptsCount" ${Prisma.raw(sortOrder)},
          e.id ${Prisma.raw(idOrder)}
        `
				:	Prisma.sql`
          e.updated_at ${Prisma.raw(sortOrder)},
          e.id ${Prisma.raw(idOrder)}
        `
			:	Prisma.sql`e.id ${Prisma.raw(idOrder)}`;

		const filterSql = this.examFilterSql(options?.filter);

		const cursorWhereSql =
			options?.sortBy?.key === 'updatedAt' && options?.lastCursor?.updatedAt ?
				options.sortBy.direction === SortDirection.ASC ?
					isForward ?
						Prisma.sql`(e.updated_at, e.id) > (${options.lastCursor.updatedAt}, ${options.lastCursor.id})`
					:	Prisma.sql`(e.updated_at, e.id) < (${options.lastCursor.updatedAt}, ${options.lastCursor.id})`
				: isForward ?
					Prisma.sql`(e.updated_at < ${options.lastCursor.updatedAt} OR (e.updated_at = ${options.lastCursor.updatedAt} AND e.id > ${options.lastCursor.id}))`
				:	Prisma.sql`(e.updated_at > ${options.lastCursor.updatedAt} OR (e.updated_at = ${options.lastCursor.updatedAt} AND e.id < ${options.lastCursor.id}))`
			: options?.lastCursor?.id ?
				isForward ? Prisma.sql`e.id > ${options.lastCursor.id}`
				:	Prisma.sql`e.id < ${options.lastCursor.id}`
			:	Prisma.sql`TRUE`;

		const cursorHavingSql =
			options?.sortBy?.key === 'attemptsCount' && options?.lastCursor?.attemptsCount !== undefined ?
				options.sortBy.direction === SortDirection.ASC ?
					isForward ?
						Prisma.sql`(COUNT(DISTINCT a.id), e.id) > (${options.lastCursor.attemptsCount}, ${options.lastCursor.id})`
					:	Prisma.sql`(COUNT(DISTINCT a.id), e.id) < (${options.lastCursor.attemptsCount}, ${options.lastCursor.id})`
				: isForward ?
					Prisma.sql`(COUNT(DISTINCT a.id) < ${options.lastCursor.attemptsCount} OR (COUNT(DISTINCT a.id) = ${options.lastCursor.attemptsCount} AND e.id > ${options.lastCursor.id}))`
				:	Prisma.sql`(COUNT(DISTINCT a.id) > ${options.lastCursor.attemptsCount} OR (COUNT(DISTINCT a.id) = ${options.lastCursor.attemptsCount} AND e.id < ${options.lastCursor.id}))`
			:	Prisma.sql`TRUE`;

		const pageMode = options?.page !== undefined;
		const offset = pageMode ? (Math.max(1, options.page ?? 1) - 1) * (options.limit ?? 10) : 0;
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
        AND ${filterSql}
        AND ${pageMode ? Prisma.sql`TRUE` : cursorWhereSql}

      GROUP BY e.id

      HAVING
        ${pageMode ? Prisma.sql`TRUE` : cursorHavingSql}

      ORDER BY ${sortSql}

      LIMIT ${options?.limit ?? 10}
      OFFSET ${offset}
    `,
		);

		if (dir === -1) rows.reverse();
		return rows.map(r => ({ ...r, description: r.description ?? undefined }));
	}

	/** Name and tag conditions on `e` (exams), shared by the list and its count. */
	private examFilterSql(filter?: {
		name?: string;
		tags?: string[];
		requiredTags?: string[];
	}): Prisma.Sql {
		// filter by name
		const nameFilterSql =
			filter?.name ?
				Prisma.sql`
        e.title ILIKE '%' || ${filter.name} || '%'
      `
				// fallback take all
			:	Prisma.sql`TRUE`;

		// An exam matches a tag when the exam, one of its sections or one of its questions carries
		// that tag or a descendant of it (nested set: lft/rgt).
		const anyTagSql = (tags: string[]) => Prisma.sql`

        EXISTS (

          SELECT 1
          FROM tags filter_t

          WHERE filter_t.name IN (
            ${Prisma.join(tags)}
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

              -- the exam's tag must be a descendant (or equal) of the filter tag
              AND t2.lft BETWEEN filter_t.lft AND filter_t.rgt

          )

        )

      `;

		// filter by tag: ANY of `tags`, and EVERY one of `requiredTags`
		const tagFilterSql =
			filter?.tags?.length ?
				anyTagSql(filter.tags)
				// fallback take all
			:	Prisma.sql`TRUE`;
		const requiredTagsSql =
			filter?.requiredTags?.length ?
				Prisma.join(
					filter.requiredTags.map(tag => anyTagSql([tag])),
					' AND ',
				)
			:	Prisma.sql`TRUE`;

		return Prisma.sql`${nameFilterSql} AND ${tagFilterSql} AND ${requiredTagsSql}`;
	}

	async countExams(filter?: {
		name?: string;
		tags?: string[];
		requiredTags?: string[];
	}): Promise<number> {
		const where = this.examFilterSql(filter);
		const [row] = await this.txHost.tx.$queryRaw<{ count: number }[]>(
			Prisma.sql`SELECT COUNT(*)::int AS count FROM exams e WHERE e.status = ${ExamStatus.Approved} AND ${where}`,
		);
		return row?.count ?? 0;
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
