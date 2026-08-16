import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

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
}

export class HydratedIdentitiesDto {
	@Expose()
	@Type(() => HydratedIdentityDto)
	@ApiProperty({ type: () => [HydratedIdentityDto] })
	identities!: HydratedIdentityDto[];
}
