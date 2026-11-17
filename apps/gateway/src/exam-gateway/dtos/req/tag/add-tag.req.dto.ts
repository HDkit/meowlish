import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class AddTagDto implements exam.AddTagDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	parentId?: string;

	@IsString()
	@ApiProperty()
	name!: string;
}
