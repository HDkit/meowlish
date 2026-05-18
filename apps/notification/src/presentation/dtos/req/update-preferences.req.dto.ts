import { notification } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesReqDto implements notification.UpdatePreferencesRequest {
	@IsString()
	identityId!: string | undefined;

	@IsOptional()
	@IsBoolean()
	emailEnabled?: boolean | undefined;

	@IsOptional()
	@IsBoolean()
	pushEnabled?: boolean | undefined;

	@IsOptional()
	@IsBoolean()
	achievementEnabled?: boolean | undefined;

	@IsOptional()
	@IsBoolean()
	reportEnabled?: boolean | undefined;

	@IsOptional()
	@IsBoolean()
	systemEnabled?: boolean | undefined;
}
