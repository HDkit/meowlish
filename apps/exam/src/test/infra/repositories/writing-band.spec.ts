import { toAdditionalData, toWritingBand } from '../../../infra/repositories/writing-band';

const feedback = {
	overall_score: 6.5,
	sub_scores: { 'Lexical Resource': 6 },
	detailed_feedback: 'ok',
	corrected_version: 'ok',
};

describe('scorer_data.comment readers (C26)', () => {
	it('reads the band from a stored object (new rows)', () => {
		expect(toWritingBand([{ comment: feedback }])).toBe(6.5);
	});

	it('reads the band from a JSON string (rows written before C26)', () => {
		expect(toWritingBand([{ comment: JSON.stringify(feedback) }])).toBe(6.5);
	});

	it('has no band for a failure record', () => {
		expect(toWritingBand([{ comment: { status: 'error', error_code: 'X' } }])).toBeNull();
	});

	it('encodes a stored object exactly once', () => {
		expect(JSON.parse(toAdditionalData(feedback))).toEqual(feedback);
	});

	it('returns an old string row as is, so it is also encoded exactly once', () => {
		expect(JSON.parse(toAdditionalData(JSON.stringify(feedback)))).toEqual(feedback);
	});

	it('gives the same additionalData for old and new rows', () => {
		expect(toAdditionalData(JSON.stringify(feedback))).toBe(toAdditionalData(feedback));
	});
});
