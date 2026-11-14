import { ApiProperty } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class AddFileToReportDto implements Omit<
	resource.AddFileToReportRequest,
	'reportId' | 'requesterId' | 'privileged'
> {
	@IsString()
	@ApiProperty()
	fileId!: string;
}
