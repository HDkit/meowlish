import { ExamCounts } from '../../../domain/repositories/management.read.repository';
import { Query } from '@server/utils';

export class GetExamCountsQuery extends Query<ExamCounts, void> {}
