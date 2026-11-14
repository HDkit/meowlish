import { auth } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class CredentialDto implements auth.Credentials_Credential {
	@Expose()
	id!: string;

	@Expose()
	type!: string;

	@Expose()
	mail?: string;
}

export class CredentialsDto implements auth.Credentials {
	@Expose()
	@Type(() => CredentialDto)
	credentials!: CredentialDto[];
}
