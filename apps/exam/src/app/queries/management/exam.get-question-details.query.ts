import { QuestionManagementInfo } from '../../../domain/read-models/management/question-info.read-model';
import { Query } from '@server/utils';

export class GetQuestionManagementDetailsQuery extends Query<
	QuestionManagementInfo,
	{ questionId: string }
> {}
