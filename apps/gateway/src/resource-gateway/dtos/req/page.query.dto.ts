import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQueryDto {
	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	@ApiPropertyOptional({ minimum: 1, default: 1 })
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(100)
	@Min(1)
	@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
	limit?: number;
}
