import { auth } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class IdentityDto implements auth.Identities_Identity {
	@Expose()
	avatarUrl?: string;

	@Expose()
	bio?: string;

	@Expose()
	fullName?: string;

	@Expose()
	id!: string;

	@Expose()
	permissions!: string[];

	@Expose()
	roles!: string[];

	@Expose()
	username!: string;

	@Expose()
	phoneNumber?: string;

	@Expose()
	isLocked!: boolean;
}

export class IdentitiesDto implements auth.Identities {
	@Expose()
	@Type(() => IdentityDto)
	identities!: IdentityDto[];

	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;
}
