import { file } from '@server/generated';
import { IsBoolean, IsMimeType, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetPresignedUrlDto implements file.GetPresignedUrlDto {
	@IsBoolean()
	isPublicFile!: boolean;

	@IsString()
	fileName!: string;

	@IsNumber()
	fileSize!: number;

	@IsMimeType()
	contentType!: string;

	@IsNotEmpty()
	@IsString()
	uploadedBy!: string;
}
