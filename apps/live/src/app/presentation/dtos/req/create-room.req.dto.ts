import { live } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class CreateRoomDto implements live.CreateRoomRequest {
	@IsString()
	name!: string | undefined;

	@IsOptional()
	@IsString()
	createdBy!: string | undefined;
}
