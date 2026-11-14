import { ApiPropertyOptional } from '@nestjs/swagger';
import { str2bool } from '@server/utils';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	type?: string;

	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? (str2bool(value) ?? value) : value,
	)
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	isRead?: boolean;

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
