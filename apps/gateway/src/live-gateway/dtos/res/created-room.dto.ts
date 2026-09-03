import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreatedRoomDto {
	@Expose()
	@ApiProperty()
	id!: string;
}
