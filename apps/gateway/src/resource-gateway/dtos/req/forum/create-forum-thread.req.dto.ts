import { ApiProperty } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateForumThreadDto implements Omit<
	resource.CreateForumThreadRequest,
	'categoryId' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(200)
	@ApiProperty({ maxLength: 200, example: 'Cách lên dàn ý IELTS Writing Task 2?' })
	title!: string;

	@IsNotEmpty()
	@IsString()
	@MaxLength(20000)
	@ApiProperty({ maxLength: 20000, description: 'Markdown' })
	body!: string;
}
