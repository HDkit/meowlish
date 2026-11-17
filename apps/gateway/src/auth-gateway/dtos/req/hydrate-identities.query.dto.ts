import { ApiProperty } from '@nestjs/swagger';
import { ToStringArray } from '@server/utils';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class HydrateIdentitiesQueryDto {
	@ArrayMaxSize(100)
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	@ToStringArray()
	ids: string[] = [];
}
