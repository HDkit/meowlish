import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class CredentialDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	type!: string;
}

export class CredentialsDto {
	@Expose()
	@Type(() => CredentialDto)
	@ApiProperty({ type: () => [CredentialDto] })
	credentials!: CredentialDto[];
}
