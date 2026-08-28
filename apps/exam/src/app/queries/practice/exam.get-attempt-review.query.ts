import { DetailedAttemptReviewData } from '../../../domain/read-models/practice/attempt-review.read-model';
import { Query } from '@server/utils';

export type GetAttemptReviewQueryPayload = {
	attemptId: string;
};

export class GetAttemptReviewQuery extends Query<
	DetailedAttemptReviewData,
	GetAttemptReviewQueryPayload
> {}
