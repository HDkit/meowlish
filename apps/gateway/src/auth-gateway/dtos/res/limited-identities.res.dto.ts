import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class LimitedIdentityDto {
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

export class LimitedIdentitiesDto {
	@Expose()
	@Type(() => LimitedIdentityDto)
	@ApiProperty({ type: () => [LimitedIdentityDto] })
	identities!: LimitedIdentityDto[];

	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;
}
