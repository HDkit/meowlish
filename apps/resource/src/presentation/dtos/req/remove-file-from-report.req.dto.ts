import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveFileFromReportReqDto
	extends RequesterReqDto
	implements resource.RemoveFileFromReportRequest
{
	@IsString()
	reportId!: string;

	@IsString()
	fileId!: string;
}
