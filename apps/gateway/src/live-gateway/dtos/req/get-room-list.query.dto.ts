import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GetRoomListQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'nextCursor/prevCursor of a previous page' })
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(50)
	@Min(1)
	@ApiPropertyOptional({ type: Number, default: 10 })
	limit?: number;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	@ApiPropertyOptional({ description: 'Rooms whose name contains this text (case-insensitive)' })
	name?: string;
}
