import { HydratedIdentityReadModel } from '../../domain/read-models/identity.read-model';
import { Query } from '@server/utils';

export class HydrateManyQuery extends Query<HydratedIdentityReadModel[], { ids: string[] }> {}
