import { IdentityReadModel } from '../../domain/read-models/identity.read-model';
import { Query } from '@server/utils';

export type FindIdentitiesByPhoneQueryResult = {
	identities: IdentityReadModel[];
	cursor: string;
};

export class FindIdentitiesByPhoneQuery extends Query<
	FindIdentitiesByPhoneQueryResult,
	{
		phoneNumber: string;
		lastId?: string;
		limit?: number;
	}
> {}
