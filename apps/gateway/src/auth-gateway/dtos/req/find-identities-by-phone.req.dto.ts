import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { auth } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max } from 'class-validator';

export class FindIdentitiesByPhoneDto implements auth.FindIdentitiesByPhoneDto {
	@IsNotEmpty()
	@IsString()
	@ApiProperty({ description: 'Part of the phone number to match', example: '0901' })
	phoneNumber!: string;

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
