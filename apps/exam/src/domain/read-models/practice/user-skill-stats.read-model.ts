import { Skill, allSkills } from '../../../enums/skill.enum';

/** A finished attempt, with the skills its exam's tags name. */
export type SkillStatsAttemptRow = {
	attemptId: string;
	examTitle: string;
	endedAt: Date;
	/** skills named by the exam's tags (or their ancestors) */
	examSkills: string[];
	/** skills already named by a section tag somewhere in the exam */
	claimedSkills: string[];
};

/** Objective questions of one attempt that share the same skill hints, counted by outcome. */
export type SkillStatsObjectiveRow = {
	attemptId: string;
	/** skills named by the question's own tags (or their ancestors) */
	questionSkills: string[];
	/** skills named by the tags of the question's section or any section above it */
	sectionSkills: string[];
	correct: number;
	incorrect: number;
	skipped: number;
};

/** One writing question of an attempt. `band` is null until the AI scorer has answered. */
export type SkillStatsWritingRow = {
	attemptId: string;
	answered: boolean;
	band: number | null;
};

export type TagAccuracy = {
	name: string;
	correct: number;
	incorrect: number;
	skipped: number;
};

export type SkillStatsSource = {
	attempts: SkillStatsAttemptRow[];
	objective: SkillStatsObjectiveRow[];
	writing: SkillStatsWritingRow[];
	tags: TagAccuracy[];
};

export type SkillScorePoint = {
	attemptId: string;
	examTitle: string;
	endedAt: Date;
	percent: number;
	band?: number;
};

export type SkillStats = {
	skill: Skill;
	attempts: number;
	averagePercent?: number;
	lastPercent?: number;
	bestPercent?: number;
	averageBand?: number;
	/** oldest first */
	recent: SkillScorePoint[];
};

export type UserSkillStats = {
	skills: SkillStats[];
	tags: TagAccuracy[];
	attemptsConsidered: number;
};

const maxWritingBand = 9;
export const recentPointsPerSkill = 10;

function asSkills(names: string[]): Skill[] {
	return [...new Set(names)].filter((s): s is Skill => (allSkills as string[]).includes(s));
}

/**
 * The skill an objective question practises: the nearest level that names exactly one skill wins
 * (question tags, then section tags, then exam tags). For an exam that names several skills, the
 * skills no section claims go to the untagged sections, e.g. a TOEIC LR exam whose listening parts
 * are tagged leaves its untagged parts to reading. Null when it stays ambiguous or unknown.
 */
export function resolveSkill(
	questionSkills: string[],
	sectionSkills: string[],
	examSkills: string[],
	claimedSkills: string[],
): Skill | null {
	for (const level of [questionSkills, sectionSkills]) {
		const skills = asSkills(level);
		if (skills.length === 1) return skills[0];
		if (skills.length > 1) return null;
	}
	const exam = asSkills(examSkills);
	const unclaimed = exam.filter(s => !claimedSkills.includes(s));
	if (unclaimed.length === 1) return unclaimed[0];
	return exam.length === 1 ? exam[0] : null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const mean = (ns: number[]): number => ns.reduce((a, b) => a + b, 0) / ns.length;

/**
 * Per-skill score of every attempt (share of the skill's questions answered correctly; a writing
 * answer earns band / 9, and answers still waiting for their band are left out), then per-skill
 * summaries. Always lists every skill, so the client can show the ones not practised yet.
 */
export function buildUserSkillStats(source: SkillStatsSource): UserSkillStats {
	type Tally = { earned: number; total: number; bands: number[] };
	const tallies = new Map<string, Map<Skill, Tally>>();
	const tally = (attemptId: string, skill: Skill): Tally => {
		let bySkill = tallies.get(attemptId);
		if (!bySkill) {
			bySkill = new Map();
			tallies.set(attemptId, bySkill);
		}
		let t = bySkill.get(skill);
		if (!t) {
			t = { earned: 0, total: 0, bands: [] };
			bySkill.set(skill, t);
		}
		return t;
	};

	const attempts = new Map(source.attempts.map(a => [a.attemptId, a]));
	for (const row of source.objective) {
		const attempt = attempts.get(row.attemptId);
		if (!attempt) continue;
		const skill = resolveSkill(
			row.questionSkills,
			row.sectionSkills,
			attempt.examSkills,
			attempt.claimedSkills,
		);
		if (!skill) continue;
		const t = tally(row.attemptId, skill);
		t.earned += row.correct;
		t.total += row.correct + row.incorrect + row.skipped;
	}
	for (const row of source.writing) {
		if (!attempts.has(row.attemptId)) continue;
		if (row.answered && row.band === null) continue;
		const t = tally(row.attemptId, Skill.Writing);
		const band = row.answered && row.band !== null ? row.band : 0;
		t.earned += Math.min(Math.max(band / maxWritingBand, 0), 1);
		t.total += 1;
		if (row.answered && row.band !== null) t.bands.push(row.band);
	}

	const ordered = [...source.attempts].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
	const skills = allSkills.map((skill): SkillStats => {
		const points: SkillScorePoint[] = [];
		for (const attempt of ordered) {
			const t = tallies.get(attempt.attemptId)?.get(skill);
			if (!t || t.total === 0) continue;
			points.push({
				attemptId: attempt.attemptId,
				examTitle: attempt.examTitle,
				endedAt: attempt.endedAt,
				percent: round1((t.earned / t.total) * 100),
				...(t.bands.length ? { band: round1(mean(t.bands)) } : {}),
			});
		}
		if (points.length === 0) return { skill: skill, attempts: 0, recent: [] };
		const percents = points.map(p => p.percent);
		const bands = points.flatMap(p => (p.band === undefined ? [] : [p.band]));
		return {
			skill: skill,
			attempts: points.length,
			averagePercent: round1(mean(percents)),
			lastPercent: percents[percents.length - 1],
			bestPercent: Math.max(...percents),
			...(bands.length ? { averageBand: round1(mean(bands)) } : {}),
			recent: points.slice(-recentPointsPerSkill),
		};
	});

	const accuracy = (t: TagAccuracy): number => {
		const total = t.correct + t.incorrect + t.skipped;
		return total === 0 ? 0 : t.correct / total;
	};
	const tags = source.tags
		.filter(t => t.correct + t.incorrect + t.skipped > 0)
		.sort(
			(a, b) =>
				accuracy(a) - accuracy(b) ||
				b.correct + b.incorrect + b.skipped - (a.correct + a.incorrect + a.skipped) ||
				a.name.localeCompare(b.name),
		);

	return { skills: skills, tags: tags, attemptsConsidered: source.attempts.length };
}
