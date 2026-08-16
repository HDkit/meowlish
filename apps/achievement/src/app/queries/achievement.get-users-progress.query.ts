import { Progress } from '../../domain/read-models/progress.read-model';
import { Query } from '@server/utils';

export class GetUsersProgressQuery extends Query<Progress, { userId: string }> {}
