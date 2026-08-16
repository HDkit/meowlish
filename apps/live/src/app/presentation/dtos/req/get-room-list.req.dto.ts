import { live } from '@server/generated';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class GetRoomListDto implements live.GetRoomListDto {
	@IsInt()
	@IsOptional()
	@IsPositive()
	limit?: number;

	@IsOptional()
	@IsString()
	cursor?: string;
}
