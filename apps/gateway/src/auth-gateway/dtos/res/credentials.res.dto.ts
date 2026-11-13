import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class CredentialDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty({ enum: ['MAIL', 'GOOGLE'] })
	type!: string;

	@Expose()
	@ApiPropertyOptional({ description: 'Email address of a MAIL credential' })
	mail?: string;
}

export class CredentialsDto {
	@Expose()
	@Type(() => CredentialDto)
	@ApiProperty({ type: () => [CredentialDto] })
	credentials!: CredentialDto[];
}
