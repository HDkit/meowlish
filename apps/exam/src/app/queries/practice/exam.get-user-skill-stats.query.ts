import { UserSkillStats } from '../../../domain/read-models/practice/user-skill-stats.read-model';
import { Query } from '@server/utils';

export type GetUserSkillStatsQueryPayload = {
	userId: string;
};

export class GetUserSkillStatsQuery extends Query<UserSkillStats, GetUserSkillStatsQueryPayload> {}
