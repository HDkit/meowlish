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

	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ type: Boolean })
	setUrlNull?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ type: Boolean })
	setTimeNull?: boolean;
}
