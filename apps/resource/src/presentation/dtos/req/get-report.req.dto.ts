import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetReportReqDto extends RequesterReqDto implements resource.GetReportRequest {
	@IsString()
	id!: string;
}
