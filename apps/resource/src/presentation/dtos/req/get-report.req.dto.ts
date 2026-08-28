import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetReportReqDto implements resource.GetReportRequest {
	@IsString()
	id!: string;
}
