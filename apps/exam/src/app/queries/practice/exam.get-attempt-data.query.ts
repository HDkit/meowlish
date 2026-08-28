import { AttemptSavedData } from '../../../domain/read-models/practice/attempt-save-data.read-model';
import { Query } from '@server/utils';

export type GetAttemptDataQueryPayload = {
	attemptId: string;
};

export class GetAttemptDataQuery extends Query<AttemptSavedData, GetAttemptDataQueryPayload> {}
