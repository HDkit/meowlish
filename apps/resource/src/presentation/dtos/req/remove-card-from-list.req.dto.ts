import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveCardFromListReqDto
	extends RequesterReqDto
	implements resource.RemoveCardFromListRequest
{
	@IsString()
	listId!: string;

	@IsString()
	flashCardId!: string;
}
