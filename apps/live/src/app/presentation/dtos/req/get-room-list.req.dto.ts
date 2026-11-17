import { live } from '@server/generated';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class GetRoomListDto implements live.GetRoomListDto {
	@IsInt()
	@IsOptional()
	@IsPositive()
	limit?: number;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;
}
