import { Prisma } from '@prisma-client/exam';

/**
 * The AI feedback is stored as the JSON-encoded `WritingScoreDataDto` (a JSON string value);
 * returns its `overall_score`, or null when there is no usable feedback.
 */
export function toWritingBand(scorerDatas: { comment: Prisma.JsonValue }[]): number | null {
	let comment: unknown = scorerDatas[0]?.comment;
	if (typeof comment === 'string') {
		try {
			comment = JSON.parse(comment);
		} catch {
			return null;
		}
	}
	if (typeof comment !== 'object' || comment === null || !('overall_score' in comment)) return null;
	const band = comment.overall_score;
	return typeof band === 'number' && Number.isFinite(band) ? band : null;
}
