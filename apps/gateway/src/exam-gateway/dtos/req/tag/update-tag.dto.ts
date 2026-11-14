import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class UpdateTagDto implements Omit<exam.UpdateTagDto, 'id'> {
	@IsString()
	@ApiProperty()
	name!: string;
}
