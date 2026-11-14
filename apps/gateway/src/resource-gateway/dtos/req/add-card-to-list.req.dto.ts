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
	@ApiPropertyOptional({
		description:
			"0-based index in the list's current order to put the card at; past the end means last. Omit to append. A card already in the list is moved.",
		example: 0,
	})
	position?: number;
}
