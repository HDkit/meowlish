import { Prisma } from '@prisma-client/exam';

/**
 * `scorer_data.comment` holds the AI feedback (`WritingScoreDataDto`) or a scoring failure record.
 * New rows store the object itself; rows written before C26 store its JSON encoding as a JSON
 * string value. Both are accepted.
 *
 * Returns the feedback's `overall_score`, or null when there is no usable feedback.
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

/**
 * The review's `additionalData`: the stored feedback JSON-encoded exactly once. A pre-C26 row is a
 * JSON string holding that encoding already, so it is returned as is.
 */
export function toAdditionalData(comment: Prisma.JsonValue): string {
	return typeof comment === 'string' ? comment : JSON.stringify(comment);
}
