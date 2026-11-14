import { ApiPropertyOptional } from '@nestjs/swagger';
import { live } from '@server/generated';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateRoomScheduleDto implements Omit<live.UpdateRoomScheduleRequest, 'roomId'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	url?: string;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	time?: Date;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	setUrlNull?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	setTimeNull?: boolean;
}
