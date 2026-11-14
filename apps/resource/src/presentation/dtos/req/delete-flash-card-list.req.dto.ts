import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteFlashCardListReqDto
	extends RequesterReqDto
	implements resource.DeleteFlashCardListRequest
{
	@IsString()
	id!: string;
}
