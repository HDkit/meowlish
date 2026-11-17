import { z } from 'zod/v4';

/** Bare payload published by exam on `exam.writing.submitted`. */
export const writingSubmittedSchema = z.object({
	attempt_id: z.string(),
	response_id: z.string(),
	question: z.string().optional(),
	content: z.string(),
	exam_type: z.string().optional(),
	task_type: z.string().optional(),
	target_score: z.number().optional(),
});

export type WritingSubmitted = z.infer<typeof writingSubmittedSchema>;

export interface WritingSubScores {
	'Task Exam': number;
	'Coherence & Cohesion': number;
	'Lexical Resource': number;
	'Grammatical Range & Accuracy': number;
}

/** Bare payload exam consumes on `exam.writing.scored`. */
export interface WritingScored {
	status: 'success';
	attempt_id: string;
	response_id: string;
	data: {
		overall_score: number;
		sub_scores: WritingSubScores;
		detailed_feedback: string;
		corrected_version: string;
		corrections: never[];
	};
}

export type Rng = () => number;

export const MIN_BAND = 4;
export const MAX_BAND = 8.5;
const BAND_STEP = 0.5;

export const MOCK_FEEDBACK =
	'This is a MOCK score generated at random by the mock-ai-scorer service. It is sample data, ' +
	'not a real assessment of your writing.';

/** Random band in [MIN_BAND, MAX_BAND] in steps of 0.5. */
export function randomBand(rng: Rng = Math.random): number {
	const steps = Math.round((MAX_BAND - MIN_BAND) / BAND_STEP);
	return MIN_BAND + Math.floor(rng() * (steps + 1)) * BAND_STEP;
}

/** Mean of the sub-scores rounded to the nearest half band. */
export function overallBand(subScores: WritingSubScores): number {
	const values = [
		subScores['Task Exam'],
		subScores['Coherence & Cohesion'],
		subScores['Lexical Resource'],
		subScores['Grammatical Range & Accuracy'],
	];
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	return Math.round(mean / BAND_STEP) * BAND_STEP;
}

export function generateScore(event: WritingSubmitted, rng: Rng = Math.random): WritingScored {
	const subScores: WritingSubScores = {
		'Task Exam': randomBand(rng),
		'Coherence & Cohesion': randomBand(rng),
		'Lexical Resource': randomBand(rng),
		'Grammatical Range & Accuracy': randomBand(rng),
	};
	return {
		status: 'success',
		attempt_id: event.attempt_id,
		response_id: event.response_id,
		data: {
			overall_score: overallBand(subScores),
			sub_scores: subScores,
			detailed_feedback: MOCK_FEEDBACK,
			corrected_version: event.content,
			// Left empty on purpose: the backend's CorrectionDto differs from the frontend's.
			corrections: [],
		},
	};
}

/** Uniform random integer delay in [minMs, maxMs]. */
export function pickDelayMs(minMs: number, maxMs: number, rng: Rng = Math.random): number {
	return minMs + Math.floor(rng() * (maxMs - minMs + 1));
}
