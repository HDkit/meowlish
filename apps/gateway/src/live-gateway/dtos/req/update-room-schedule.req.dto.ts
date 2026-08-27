import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRoomScheduleDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	url?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	time?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	setUrlNull?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	setTimeNull?: boolean;
}
