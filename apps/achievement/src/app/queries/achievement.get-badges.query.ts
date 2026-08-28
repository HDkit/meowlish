import { Badge } from '../../domain/read-models/badge.read-model';
import { Query } from '@server/utils';

export type GetBadgesQueryResult = {
	badges: Badge[];
};

export class GetBadgesQuery extends Query<GetBadgesQueryResult> {}
