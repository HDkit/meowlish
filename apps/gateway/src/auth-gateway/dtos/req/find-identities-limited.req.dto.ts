import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Max } from 'class-validator';

export class FindIdentitiesLimitedDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	usernameOrCredIdentifier?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(100)
	@ApiPropertyOptional({ type: Number, maximum: 100 })
	limit?: number;
}
