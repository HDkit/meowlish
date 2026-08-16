import { FileService } from '../../app/services/file.service';
import { GetPresignedUrlDto } from '../dtos/req/get-presigned-url.req.dto';
import { GetUrlsDto } from '../dtos/req/get-urls.req.dto';
import { PresignedUrlResponseDto } from '../dtos/res/presigned-url.res.dto';
import { UrlsDto } from '../dtos/res/urls.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { file } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@file.FileServiceControllerMethods()
@Controller()
export class FileController implements file.FileServiceController {
	constructor(private readonly fileService: FileService) {}

	@SerializeOptions({ type: PresignedUrlResponseDto, strategy: 'exposeAll' })
	async getPresignedUrl(@Payload() request: GetPresignedUrlDto): Promise<PresignedUrlResponseDto> {
		return await this.fileService.getPresignedUrl(
			{
				contentType: request.contentType,
				fileName: request.fileName,
				fileSize: request.fileSize,
			},
			request.isPublicFile,
		);
	}

	@SerializeOptions({ type: UrlsDto, strategy: 'exposeAll' })
	async getUrls(@Payload() request: GetUrlsDto): Promise<UrlsDto> {
		const urls = await this.fileService.getFilesUrls(request.ids);
		return { urls: urls };
	}
}
