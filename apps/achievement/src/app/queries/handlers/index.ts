import { GetBadgesQueryHandler } from './get-badges.handler';
import { GetUsersBadgesQueryHandler } from './get-users-badges.handler';
import { GetUsersProgressQueryHandler } from './get-users-progress.handler';

export const BadgesQueryHandlers = [
	GetBadgesQueryHandler,
	GetUsersBadgesQueryHandler,
	GetUsersProgressQueryHandler,
];
