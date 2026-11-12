import {
	MAX_BAND,
	MIN_BAND,
	MOCK_FEEDBACK,
	generateScore,
	overallBand,
	pickDelayMs,
	randomBand,
} from './score-generator';

const event = {
	attempt_id: 'a1',
	response_id: 'r1',
	question: 'q',
	content: 'My essay.',
	exam_type: 'IELTS',
	task_type: 'Task 2',
	target_score: 7,
};

describe('score generator', () => {
	it('keeps bands in range and in half steps', () => {
		for (let i = 0; i < 500; i++) {
			const band = randomBand();
			expect(band).toBeGreaterThanOrEqual(MIN_BAND);
			expect(band).toBeLessThanOrEqual(MAX_BAND);
			expect((band * 2) % 1).toBe(0);
		}
		expect(randomBand(() => 0)).toBe(MIN_BAND);
		expect(randomBand(() => 0.999999)).toBe(MAX_BAND);
	});

	it('rounds the overall score to the nearest half of the mean', () => {
		const sub = (a: number, b: number, c: number, d: number) => ({
			'Task Exam': a,
			'Coherence & Cohesion': b,
			'Lexical Resource': c,
			'Grammatical Range & Accuracy': d,
		});
		expect(overallBand(sub(6, 6, 6, 6))).toBe(6);
		expect(overallBand(sub(6, 6, 6, 7))).toBe(6.5); // mean 6.25 -> 6.5
		expect(overallBand(sub(6, 6, 6.5, 6.5))).toBe(6.5); // mean 6.25 -> 6.5
		expect(overallBand(sub(5, 5, 5, 5.5))).toBe(5); // mean 5.125 -> 5
	});

	it('builds the payload exam expects', () => {
		const scored = generateScore(event);
		expect(scored.status).toBe('success');
		expect(scored.attempt_id).toBe('a1');
		expect(scored.response_id).toBe('r1');
		expect(Object.keys(scored.data.sub_scores)).toEqual([
			'Task Exam',
			'Coherence & Cohesion',
			'Lexical Resource',
			'Grammatical Range & Accuracy',
		]);
		expect(scored.data.overall_score).toBe(overallBand(scored.data.sub_scores));
		expect(scored.data.detailed_feedback).toBe(MOCK_FEEDBACK);
		expect(scored.data.corrected_version).toBe('My essay.');
		expect(scored.data.corrections).toEqual([]);
	});
});

describe('pickDelayMs', () => {
	it('stays within bounds', () => {
		for (let i = 0; i < 500; i++) {
			const ms = pickDelayMs(2000, 8000);
			expect(ms).toBeGreaterThanOrEqual(2000);
			expect(ms).toBeLessThanOrEqual(8000);
		}
		expect(pickDelayMs(10, 20, () => 0)).toBe(10);
		expect(pickDelayMs(10, 20, () => 0.999999)).toBe(20);
		expect(pickDelayMs(5, 5)).toBe(5);
	});
});
