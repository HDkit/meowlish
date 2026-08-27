import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateReportReqDto implements resource.CreateReportRequest {
	@IsString()
	reportedBy!: string | undefined;

	@IsString()
	type!: string | undefined;

	@IsString()
	title!: string | undefined;

	@IsString()
	description!: string | undefined;

	@IsOptional()
	@IsString()
	targetType?: string | undefined;

	@IsOptional()
	@IsString()
	targetId?: string | undefined;

	@IsArray()
	@IsString({ each: true })
	fileIds!: string[];
}
