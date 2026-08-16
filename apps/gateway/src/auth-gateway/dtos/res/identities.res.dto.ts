import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class IdentityDto {
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
	@ApiProperty({ type: [String] })
	permissions!: string[];

	@Expose()
	@ApiProperty({ type: () => [String] })
	roles!: string[];

	@Expose()
	@ApiProperty()
	username!: string;
}

export class IdentitiesDto {
	@Expose()
	@Type(() => IdentityDto)
	@ApiProperty({ type: () => [IdentityDto] })
	identities!: IdentityDto[];

	@Expose()
	@ApiProperty()
	cursor!: string;
}
