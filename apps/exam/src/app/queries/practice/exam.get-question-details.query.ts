import { DetailedQuestionInfo } from '../../../domain/read-models/practice/detailed-question.read-model';
import { Query } from '@server/utils';

export type GetQuestionDetailsQueryPayload = {
	questionId: string;
};

export class GetQuestionDetailsQuery extends Query<
	DetailedQuestionInfo,
	GetQuestionDetailsQueryPayload
> {}
