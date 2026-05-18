import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class AddFileToReportReqDto implements resource.AddFileToReportRequest {
	@IsString()
	reportId!: string | undefined;

	@IsString()
	fileId!: string | undefined;
}
