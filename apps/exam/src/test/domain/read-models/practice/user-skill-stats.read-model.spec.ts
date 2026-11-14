import {
	SkillStatsAttemptRow,
	SkillStatsSource,
	buildUserSkillStats,
	resolveSkill,
} from '../../../../domain/read-models/practice/user-skill-stats.read-model';
import { Skill } from '../../../../enums/skill.enum';

describe('resolveSkill', () => {
	it('prefers the nearest level naming exactly one skill', () => {
		expect(resolveSkill(['READING'], ['LISTENING'], [], [])).toBe(Skill.Reading);
		expect(resolveSkill([], ['LISTENING'], ['READING'], [])).toBe(Skill.Listening);
		expect(resolveSkill([], [], ['READING'], ['READING'])).toBe(Skill.Reading);
	});

	it('gives the untagged parts of a multi-skill exam the skill no section claims', () => {
		expect(resolveSkill([], [], ['LISTENING', 'READING'], ['LISTENING'])).toBe(Skill.Reading);
	});

	it('is null when ambiguous or unknown', () => {
		expect(resolveSkill(['LISTENING', 'READING'], ['READING'], [], [])).toBeNull();
		expect(resolveSkill([], [], ['LISTENING', 'READING'], [])).toBeNull();
		expect(resolveSkill([], [], [], [])).toBeNull();
		expect(resolveSkill(['GRAMMAR'], [], [], [])).toBeNull();
	});
});

describe('buildUserSkillStats', () => {
	const attempt = (id: string, day: number, examSkills: string[]): SkillStatsAttemptRow => ({
		attemptId: id,
		examTitle: `Exam ${id}`,
		endedAt: new Date(Date.UTC(2026, 10, day)),
		examSkills: examSkills,
		claimedSkills: [],
	});
	const empty: SkillStatsSource = { attempts: [], objective: [], writing: [], tags: [] };

	it('lists all four skills even without attempts', () => {
		const stats = buildUserSkillStats(empty);
		expect(stats.skills.map(s => s.skill)).toEqual([
			Skill.Listening,
			Skill.Reading,
			Skill.Writing,
			Skill.Speaking,
		]);
		expect(stats.skills.every(s => s.attempts === 0 && s.recent.length === 0)).toBe(true);
		expect(stats.attemptsConsidered).toBe(0);
	});

	it('scores each attempt per skill, skipped questions counting as missed, oldest first', () => {
		const stats = buildUserSkillStats({
			...empty,
			attempts: [attempt('new', 10, ['READING']), attempt('old', 2, ['READING'])],
			objective: [
				{
					attemptId: 'old',
					questionSkills: [],
					sectionSkills: [],
					correct: 1,
					incorrect: 2,
					skipped: 1,
				},
				{
					attemptId: 'new',
					questionSkills: [],
					sectionSkills: [],
					correct: 3,
					incorrect: 1,
					skipped: 0,
				},
				{
					attemptId: 'new',
					questionSkills: [],
					sectionSkills: ['LISTENING'],
					correct: 2,
					incorrect: 0,
					skipped: 0,
				},
			],
		});
		const reading = stats.skills.find(s => s.skill === Skill.Reading);
		expect(reading?.recent.map(p => [p.attemptId, p.percent])).toEqual([
			['old', 25],
			['new', 75],
		]);
		expect(reading).toMatchObject({
			attempts: 2,
			averagePercent: 50,
			lastPercent: 75,
			bestPercent: 75,
		});
		expect(stats.skills.find(s => s.skill === Skill.Listening)?.lastPercent).toBe(100);
	});

	it('scores writing by band, leaving out answers still waiting for their band', () => {
		const stats = buildUserSkillStats({
			...empty,
			attempts: [attempt('w', 5, ['WRITING'])],
			writing: [
				{ attemptId: 'w', answered: true, band: 6 },
				{ attemptId: 'w', answered: true, band: 7 },
				{ attemptId: 'w', answered: true, band: null },
			],
		});
		const writing = stats.skills.find(s => s.skill === Skill.Writing);
		expect(writing?.recent[0]).toMatchObject({ percent: 72.2, band: 6.5 });
		expect(writing?.averageBand).toBe(6.5);
	});

	it('counts an unanswered writing task as zero', () => {
		const stats = buildUserSkillStats({
			...empty,
			attempts: [attempt('w', 5, [])],
			writing: [
				{ attemptId: 'w', answered: true, band: 9 },
				{ attemptId: 'w', answered: false, band: null },
			],
		});
		expect(stats.skills.find(s => s.skill === Skill.Writing)?.lastPercent).toBe(50);
	});

	it('keeps only the latest ten points per skill', () => {
		const attempts = Array.from({ length: 12 }, (_, i) => attempt(`a${i}`, i + 1, ['LISTENING']));
		const stats = buildUserSkillStats({
			...empty,
			attempts: attempts,
			objective: attempts.map(a => ({
				attemptId: a.attemptId,
				questionSkills: [],
				sectionSkills: [],
				correct: 1,
				incorrect: 0,
				skipped: 0,
			})),
		});
		const listening = stats.skills.find(s => s.skill === Skill.Listening);
		expect(listening?.attempts).toBe(12);
		expect(listening?.recent).toHaveLength(10);
		expect(listening?.recent[0].attemptId).toBe('a2');
	});

	it('sorts tags weakest first and drops empty ones', () => {
		const stats = buildUserSkillStats({
			...empty,
			tags: [
				{ name: 'Inference', correct: 8, incorrect: 2, skipped: 0 },
				{ name: 'Tenses', correct: 1, incorrect: 2, skipped: 1 },
				{ name: 'Empty', correct: 0, incorrect: 0, skipped: 0 },
				{ name: 'Detail', correct: 4, incorrect: 4, skipped: 2 },
			],
		});
		expect(stats.tags.map(t => t.name)).toEqual(['Tenses', 'Detail', 'Inference']);
	});
});
