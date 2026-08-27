import { IdentityReadModel } from '../../domain/read-models/identity.read-model';
import { Query } from '@server/utils';

export type FindIdentitiesByPhoneQueryResult = {
	identities: IdentityReadModel[];
	nextCursor: string;
	prevCursor: string;
};

type FindIdentitiesByPhoneCursor = {
	phoneNumber?: string;
	lastId?: string;
	direction?: number;
	limit?: number;
};

export class FindIdentitiesByPhoneQuery extends Query<
	FindIdentitiesByPhoneQueryResult,
	{
		cursor?: string;
	} & Omit<FindIdentitiesByPhoneCursor, 'lastId'>
> {}
