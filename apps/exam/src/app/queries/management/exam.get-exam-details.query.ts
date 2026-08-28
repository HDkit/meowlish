import { ExamManagementDetailedInfo } from '../../../domain/read-models/management/exam-info.read-model';
import { Query } from '@server/utils';

export class GetExamManagementDetailsQuery extends Query<
	ExamManagementDetailedInfo,
	{ examId: string }
> {}
