import { file } from '@server/generated';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CheckFilesOwnedByDto implements file.CheckFilesOwnedByDto {
	@IsArray()
	@IsString({ each: true })
	fileIds!: string[];

	@IsNotEmpty()
	@IsString()
	userId!: string;
}
