import { notification } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesReqDto implements notification.UpdatePreferencesRequest {
	@IsString()
	identityId!: string | undefined;

	@IsBoolean()
	@IsOptional()
	emailEnabled?: boolean | undefined;

	@IsBoolean()
	@IsOptional()
	pushEnabled?: boolean | undefined;

	@IsBoolean()
	@IsOptional()
	achievementEnabled?: boolean | undefined;

	@IsBoolean()
	@IsOptional()
	reportEnabled?: boolean | undefined;

	@IsBoolean()
	@IsOptional()
	systemEnabled?: boolean | undefined;
}
