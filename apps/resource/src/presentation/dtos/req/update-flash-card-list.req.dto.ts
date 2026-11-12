import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardListReqDto
	extends RequesterReqDto
	implements resource.UpdateFlashCardListRequest
{
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
