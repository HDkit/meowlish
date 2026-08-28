import { FILE_CLIENT } from './constants/file';
import { GetPresignedUrlDto } from './dtos/req/get-presigned-url.req.dto';
import { PresignedUrlResponseDto } from './dtos/res/presigned-url.res.dto';
import { Body, Controller, Inject, OnModuleInit, Post, SerializeOptions } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { file } from '@server/generated';
import { ApiResponseEntity } from '@server/utils';

@ApiBearerAuth()
@ApiTags('Files')
@Controller()
export class FileGatewayController implements OnModuleInit {
	private fileService!: file.FileServiceClient;

	constructor(@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	@Post()
	@ApiOperation({ summary: 'Create a presigned upload URL' })
	@ApiResponseEntity(PresignedUrlResponseDto)
	@SerializeOptions({ type: PresignedUrlResponseDto, strategy: 'exposeAll' })
	getPresignedUrl(@Body() body: GetPresignedUrlDto) {
		return this.fileService.getPresignedUrl(body);
	}
}
