import { auth } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class HydratedIdentityDto implements auth.HydratedIdentities_HydratedIdentity {
	@Expose()
	avatarUrl?: string;

	@Expose()
	bio?: string;

	@Expose()
	fullName?: string;

	@Expose()
	id!: string;

	@Expose()
	username!: string;
}

export class HydratedIdentitiesDto implements auth.HydratedIdentities {
	@Expose()
	@Type(() => HydratedIdentityDto)
	identities!: HydratedIdentityDto[];
}
