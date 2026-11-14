import { auth } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto implements auth.RefreshDto {
	@IsString()
	identityId!: string;

	@IsOptional()
	@IsString()
	jti!: string | undefined;

	@IsOptional()
	@IsString()
	family!: string | undefined;
}
