import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateReportReqDto implements resource.CreateReportRequest {
	@IsString()
	reportedBy!: string;

	@IsString()
	type!: string;

	@IsString()
	title!: string;

	@IsString()
	description!: string;

	@IsOptional()
	@IsString()
	targetType?: string;

	@IsOptional()
	@IsString()
	targetId?: string;

	@IsArray()
	@IsString({ each: true })
	fileIds!: string[];
}
