import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** `?tags=a` arrives as a string and `?tags=a&tags=b` as an array; always hand on an array. */
export const ToStringArray = () =>
	Transform(({ value }: { value: unknown }) =>
		value === undefined || value === '' ? []
		: Array.isArray(value) ? (value as unknown[])
		: [value],
	);

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
