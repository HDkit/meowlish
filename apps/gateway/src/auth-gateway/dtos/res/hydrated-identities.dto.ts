import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/** Profile fields safe to show anyone (served by the public hydrate routes). */
export class PublicIdentityDto {
	@Expose()
	@ApiPropertyOptional()
	avatarUrl?: string;

	@Expose()
	@ApiPropertyOptional()
	bio?: string;

	@Expose()
	@ApiPropertyOptional()
	fullName?: string;

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	username!: string;

	@Expose()
	@ApiProperty({ type: [String] })
	roles!: string[];
}

export class PublicIdentitiesDto {
	@Expose()
	@Type(() => PublicIdentityDto)
	@ApiProperty({ type: () => [PublicIdentityDto] })
	identities!: PublicIdentityDto[];
}

/** Full profile, including private contact details; only for the identity itself. */
export class HydratedIdentityDto {
	@Expose()
	@ApiPropertyOptional()
	avatarUrl?: string;

	@Expose()
	@ApiPropertyOptional()
	bio?: string;

	@Expose()
	@ApiPropertyOptional()
	fullName?: string;

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	username!: string;

	@Expose()
	@ApiPropertyOptional()
	phoneNumber?: string;

	@Expose()
	@ApiProperty({ type: [String] })
	roles!: string[];

	@Expose()
	@ApiProperty({
		description: 'Shared demo account: password, sign-in methods, username and phone are read-only',
	})
	isDemo!: boolean;
}

export class HydratedIdentitiesDto {
	@Expose()
	@Type(() => HydratedIdentityDto)
	@ApiProperty({ type: () => [HydratedIdentityDto] })
	identities!: HydratedIdentityDto[];
}
