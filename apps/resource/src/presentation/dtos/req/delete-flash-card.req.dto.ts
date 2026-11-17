import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteFlashCardReqDto
	extends RequesterReqDto
	implements resource.DeleteFlashCardRequest
{
	@IsString()
	id!: string;
}
