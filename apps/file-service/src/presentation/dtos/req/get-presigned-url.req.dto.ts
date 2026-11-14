import { file } from '@server/generated';
import { IsBoolean, IsInt, IsMimeType, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class GetPresignedUrlDto implements file.GetPresignedUrlDto {
	@IsBoolean()
	isPublicFile!: boolean;

	@IsString()
	fileName!: string;

	@IsInt()
	@IsPositive()
	fileSize!: number;

	@IsMimeType()
	contentType!: string;

	@IsNotEmpty()
	@IsString()
	uploadedBy!: string;
}
