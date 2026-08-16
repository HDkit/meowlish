import { live } from '@server/generated';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateRoomDto implements live.UpdateRoomScheduleRequest {
	@IsOptional()
	@IsString()
	url?: string;

	@IsString()
	roomId!: string;

	@IsBoolean()
	@IsOptional()
	setUrlNull?: boolean;

	@IsBoolean()
	@IsOptional()
	setTimeNull?: boolean;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	time?: Date;
}
