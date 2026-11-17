import { ApiProperty } from '@nestjs/swagger';
import { file } from '@server/generated';
import { IsBoolean, IsInt, IsMimeType, IsPositive, IsString } from 'class-validator';

export class GetPresignedUrlDto implements Omit<file.GetPresignedUrlDto, 'uploadedBy'> {
	@IsBoolean()
	@ApiProperty()
	isPublicFile!: boolean;

	@IsString()
	@ApiProperty()
	fileName!: string;

	@IsInt()
	@IsPositive()
	@ApiProperty({
		type: Number,
		minimum: 1,
		description: 'Size in bytes. file-service rejects files over 10 MB with 400.',
	})
	fileSize!: number;

	@IsMimeType()
	@ApiProperty({
		description:
			'file-service accepts image/jpeg, image/png, application/pdf, video/mp4 and audio/mpeg; anything else is 400.',
	})
	contentType!: string;
}
