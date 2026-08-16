import { RoleReadModel } from '../../domain/read-models/role.read-model';
import { Query } from '@server/utils';

export class GetRolesQuery extends Query<RoleReadModel[]> {}
