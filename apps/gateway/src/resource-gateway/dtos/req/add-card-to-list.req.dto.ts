import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCardToListDto implements Omit<
	resource.AddCardToListRequest,
	'listId' | 'requesterId' | 'privileged'
> {
	@IsString()
	@ApiProperty()
	flashCardId!: string;

	@IsInt()
	@IsOptional()
	@Min(0)
	@ApiPropertyOptional()
	position?: number;
}
