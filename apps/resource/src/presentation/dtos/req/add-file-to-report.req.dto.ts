import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class AddFileToReportReqDto
	extends RequesterReqDto
	implements resource.AddFileToReportRequest
{
	@IsString()
	reportId!: string;

	@IsString()
	fileId!: string;
}
