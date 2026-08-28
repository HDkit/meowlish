import { live } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class CreateRoomDto implements live.CreateRoomRequest {
	@IsString()
	name!: string;

	@IsOptional()
	@IsString()
	createdBy!: string;
}
