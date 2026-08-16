import { HydratedIdentityReadModel } from '../../domain/read-models/identity.read-model';
import { Query } from '@server/utils';

export class HydrateQuery extends Query<HydratedIdentityReadModel, { id: string }> {}
