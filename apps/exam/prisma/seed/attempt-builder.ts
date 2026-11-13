import {
	QuestionType,
	questionTypesThatAllowNonStrictMatch,
} from '../../src/enums/question-type.enum';

/**
 * Pure helpers that turn a seeded attempt plan into rows that look like what the app itself
 * writes: an attempt only starts after the previous one of the same (user, exam) was submitted,
 * at most one is open, `order` follows the repository's rule (finished attempts 1..n, the open
 * one n + 1) and the score is what `AttemptEvaluator` would compute from the answers.
 */

/** Prefix of every attempt id the seed creates. Cleanup only ever deletes rows carrying it. */
export const SEED_ATTEMPT_PREFIX = 'seed-attempt-';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Same grace the attempt aggregate allows past the duration limit. */
const NETWORK_DELAY_MS = 30_000;
const MAX_WRITING_BAND = 9;

export interface SeedAttemptPlan {
	/** Suffix of the attempt id (`seed-attempt-<key>`); keep it stable so re-runs replace the row. */
	key: string;
	userId: string;
	examId: string;
	/** Finished attempts: submitted this many UTC days before today. Ignored for the open one. */
	daysAgo: number;
	/** Finished attempts: UTC hour of the submit (clamped to "a minute ago" for today). */
	utcHour: number;
	/** Minutes spent: from start to submit, or since the start for the open attempt. */
	minutes: number;
	/** Share of objective questions answered correctly (exact: rounded to whole questions). */
	accuracy: number;
	/** Share of objective questions left unanswered. */
	skipRate: number;
	/** The one unfinished attempt of its (user, exam). */
	open?: boolean;
	/** Writing answers and the band the AI scorer "gave" them (writing exams only). */
	writing?: { essays: string[]; band: number };
}

export interface SeedChoice {
	key: string;
	isCorrect: boolean;
}

export interface SeedQuestion {
	id: string;
	type: QuestionType;
	points: number;
	choices: SeedChoice[];
}

export interface SeedResponseRow {
	questionId: string;
	answers: string[];
	isCorrect: boolean | null;
	/** Writing only: the stored AI feedback (`scorer_data.comment`). */
	writingFeedback?: string;
}

export interface SeedAttemptRow {
	id: string;
	attemptedBy: string;
	examId: string;
	order: number;
	startedAt: Date;
	endedAt: Date | null;
	durationLimit: number;
	isStrict: boolean;
	score: number | null;
	totalPoints: number | null;
	responses: SeedResponseRow[];
}

/** Narrows a question type read from the database. */
export function toQuestionType(type: string): QuestionType {
	const found = Object.values(QuestionType).find(t => String(t) === type);
	if (!found) throw new Error(`Unknown question type ${type}`);
	return found;
}

export const seedAttemptId = (plan: Pick<SeedAttemptPlan, 'key'>): string =>
	`${SEED_ATTEMPT_PREFIX}${plan.key}`;

/** Deterministic PRNG (mulberry32) seeded from a string, so re-runs pick the same answers. */
export function seededRandom(seed: string): () => number {
	let h = 1779033703 ^ seed.length;
	for (let i = 0; i < seed.length; i++) {
		h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	let a = h >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled<T>(items: T[], random: () => number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

const normalize = (answers: string[]): string[] => answers.map(a => a.toLowerCase()).sort();

const correctKeys = (q: SeedQuestion): string[] =>
	q.choices.filter(c => c.isCorrect).map(c => c.key);

/** Whether `answers` score the question, by the same rules as `AttemptEvaluator.scoreFor`. */
export function isAnswerCorrect(q: SeedQuestion, answers: string[]): boolean {
	const given = normalize(answers);
	const keys = normalize(correctKeys(q));
	if (questionTypesThatAllowNonStrictMatch.includes(q.type))
		return keys.some(k => given.includes(k));
	return given.length === keys.length && given.every((a, i) => a === keys[i]);
}

/** The answer a student who knows it would give (one key for single-answer types). */
function rightAnswer(q: SeedQuestion): string[] | null {
	const keys = correctKeys(q);
	if (!keys.length) return null;
	const answers = q.type === QuestionType.MultipleChoiceMultiple ? keys : [keys[0]];
	return isAnswerCorrect(q, answers) ? answers : null;
}

/** A plausible wrong answer: another choice, or (for blanks) another blank's answer of the exam. */
function wrongAnswer(q: SeedQuestion, pool: string[], random: () => number): string[] {
	const wrongKeys = q.choices.filter(c => !c.isCorrect).map(c => c.key);
	if (q.type === QuestionType.MultipleChoiceMultiple) {
		const keys = correctKeys(q);
		const answers = [...keys.slice(0, Math.max(keys.length - 1, 1))];
		if (wrongKeys.length) answers.push(wrongKeys[Math.floor(random() * wrongKeys.length)]);
		if (!isAnswerCorrect(q, answers)) return answers;
	}
	if (wrongKeys.length) return [wrongKeys[Math.floor(random() * wrongKeys.length)]];
	const candidates = pool.filter(p => !isAnswerCorrect(q, [p]));
	return [candidates.length ? candidates[Math.floor(random() * candidates.length)] : 'not sure'];
}

const writingPoints = (points: number, band: number): number =>
	Math.round(points * Math.min(Math.max(band / MAX_WRITING_BAND, 0), 1));

/** Feedback in the shape the AI writing scorer stores (a JSON-encoded string value). */
function writingFeedback(band: number): string {
	const sub = (delta: number) => Math.min(Math.max(band + delta, 0), MAX_WRITING_BAND);
	return JSON.stringify({
		overall_score: band,
		sub_scores: {
			'Task Achievement': sub(0),
			'Coherence and Cohesion': sub(0.5),
			'Lexical Resource': sub(-0.5),
			'Grammatical Range and Accuracy': sub(0),
		},
		detailed_feedback:
			'**Strengths:** the response addresses every part of the task and is organised into clear paragraphs with a logical progression.\n\n' +
			'**Areas for improvement:** develop the main ideas with more specific support, vary sentence structures, and avoid repeating the same linking words.',
		corrected_version: '',
		corrections: [
			{
				error_type: 'Grammar',
				original_text: 'have increase',
				corrected_text: 'have increased',
				explanation: 'Use the past participle after "have".',
			},
			{
				error_type: 'Word Choice',
				original_text: 'very big',
				corrected_text: 'substantial',
				explanation: 'A more precise, academic adjective.',
			},
		],
	});
}

/**
 * Answers for one attempt. Exactly `round(accuracy * answerable)` objective questions get the
 * right answer, so whether a score counts as "good" (80 %+) doesn't depend on chance.
 */
export function buildResponses(
	plan: SeedAttemptPlan,
	questions: SeedQuestion[],
): { responses: SeedResponseRow[]; score: number; totalPoints: number } {
	const random = seededRandom(seedAttemptId(plan));
	const objective = questions.filter(q => q.type !== QuestionType.Writing);
	const writing = questions.filter(q => q.type === QuestionType.Writing);
	const pool = [...new Set(objective.flatMap(correctKeys))];

	const order = shuffled(objective, random);
	const skipped = Math.round(plan.skipRate * objective.length);
	const answered = order.slice(skipped);
	const answerable = answered.filter(q => rightAnswer(q) !== null);
	const rightCount = Math.min(Math.round(plan.accuracy * objective.length), answerable.length);
	const right = new Set(answerable.slice(0, rightCount).map(q => q.id));

	const responses: SeedResponseRow[] = [];
	let score = 0;
	let totalPoints = 0;
	const answeredIds = new Set(answered.map(q => q.id));
	for (const q of questions) {
		totalPoints += q.points;
		if (q.type === QuestionType.Writing) {
			const essay = plan.writing?.essays[writing.indexOf(q)];
			if (!essay || !plan.writing) continue;
			const finished = !plan.open;
			responses.push({
				questionId: q.id,
				answers: [essay],
				isCorrect: finished ? false : null,
				...(finished ? { writingFeedback: writingFeedback(plan.writing.band) } : {}),
			});
			if (finished) score += writingPoints(q.points, plan.writing.band);
			continue;
		}
		if (!answeredIds.has(q.id)) continue;
		const answers = right.has(q.id) ? (rightAnswer(q) ?? []) : wrongAnswer(q, pool, random);
		const correct = isAnswerCorrect(q, answers);
		responses.push({
			questionId: q.id,
			answers: answers,
			// unscored until the attempt is submitted
			isCorrect: plan.open ? null : correct,
		});
		if (correct) score += q.points;
	}
	return { responses: responses, score: score, totalPoints: totalPoints };
}

/** Start and submit times of a plan, relative to `now`. */
export function planTimes(
	plan: SeedAttemptPlan,
	now: Date,
): { startedAt: Date; endedAt: Date | null } {
	if (plan.open)
		return { startedAt: new Date(now.getTime() - plan.minutes * MINUTE), endedAt: null };
	const today = Math.floor(now.getTime() / DAY) * DAY;
	let ended = today - plan.daysAgo * DAY + plan.utcHour * 60 * MINUTE;
	ended = Math.min(ended, now.getTime() - MINUTE);
	return { startedAt: new Date(ended - plan.minutes * MINUTE), endedAt: new Date(ended) };
}

/**
 * Checks the plans of one (user, exam) pair against the attempt rules and returns them with their
 * `order`: finished attempts 1..n by submit time, then the open one (n + 1).
 */
export function orderPairPlans(
	plans: SeedAttemptPlan[],
	durationLimitSeconds: number,
	now: Date,
): { plan: SeedAttemptPlan; order: number; startedAt: Date; endedAt: Date | null }[] {
	const timed = plans.map(p => ({ plan: p, ...planTimes(p, now) }));
	const open = timed.filter(t => t.endedAt === null);
	if (open.length > 1)
		throw new Error(`Seed plans ${plans.map(p => p.key).join(', ')}: more than one open attempt`);
	const finished = timed
		.filter(t => t.endedAt !== null)
		.sort((a, b) => (a.endedAt?.getTime() ?? 0) - (b.endedAt?.getTime() ?? 0));
	const ordered = [...finished, ...open];
	const limitMs = durationLimitSeconds * 1000 + NETWORK_DELAY_MS;
	ordered.forEach((t, i) => {
		const previousEnd = ordered[i - 1]?.endedAt;
		// A new attempt can only be started once the previous one is submitted.
		if (previousEnd && t.startedAt < previousEnd)
			throw new Error(`Seed attempt ${t.plan.key} starts before ${ordered[i - 1].plan.key} ended`);
		const end = t.endedAt ?? now;
		if (end.getTime() - t.startedAt.getTime() > limitMs)
			throw new Error(`Seed attempt ${t.plan.key} runs past its time limit`);
	});
	return ordered.map((t, i) => ({ ...t, order: i + 1 }));
}

/** All rows for the plans of one (user, exam) pair. */
export function buildPairAttempts(
	plans: SeedAttemptPlan[],
	exam: { duration: number; questions: SeedQuestion[] },
	now: Date,
): SeedAttemptRow[] {
	return orderPairPlans(plans, exam.duration, now).map(({ plan, order, startedAt, endedAt }) => {
		const { responses, score, totalPoints } = buildResponses(plan, exam.questions);
		return {
			id: seedAttemptId(plan),
			attemptedBy: plan.userId,
			examId: plan.examId,
			order: order,
			startedAt: startedAt,
			endedAt: endedAt,
			durationLimit: exam.duration,
			isStrict: true,
			score: endedAt ? score : null,
			totalPoints: endedAt ? totalPoints : null,
			responses: responses,
		};
	});
}

/** Groups plans by (user, exam). */
export function groupPlansByPair(plans: SeedAttemptPlan[]): Map<string, SeedAttemptPlan[]> {
	const pairs = new Map<string, SeedAttemptPlan[]>();
	for (const plan of plans) {
		const key = `${plan.userId}|${plan.examId}`;
		pairs.set(key, [...(pairs.get(key) ?? []), plan]);
	}
	return pairs;
}
