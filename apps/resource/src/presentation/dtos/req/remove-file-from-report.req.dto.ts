import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveFileFromReportReqDto implements resource.RemoveFileFromReportRequest {
	@IsString()
	reportId!: string;

	@IsString()
	fileId!: string;
}
