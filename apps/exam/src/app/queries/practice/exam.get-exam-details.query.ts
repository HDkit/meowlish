import { DetailedExamInfo } from '../../../domain/read-models/practice/detailed-exam.read-model';
import { Query } from '@server/utils';

export type GetExamDetailsQueryPayload = {
	examId: string;
};

export class GetExamDetailsQuery extends Query<DetailedExamInfo, GetExamDetailsQueryPayload> {}
