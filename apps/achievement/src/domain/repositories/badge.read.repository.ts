import { Badge, UserBadge } from '../read-models/badge.read-model';
import { Progress } from '../read-models/progress.read-model';

export interface IBadgeReadRepository {
	getAll(): Promise<Badge[]>;
	getUsersBadges(userId: string, opts?: { lastId?: string; limit?: number }): Promise<UserBadge[]>;
	getUsersProgress(userId: string): Promise<Progress>;
}

export const IBadgeReadRepositoryToken = Symbol('IBadgeReadRepository');
