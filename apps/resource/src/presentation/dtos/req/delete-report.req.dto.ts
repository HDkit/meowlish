import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteReportReqDto implements resource.DeleteReportRequest {
	@IsString()
	id!: string;
}
