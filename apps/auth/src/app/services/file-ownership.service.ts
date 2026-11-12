import { FILE_CLIENT } from '../../constants/file';
import { ForbiddenException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

/** Asks the file service who uploaded a file before it is attached anywhere. */
@Injectable()
export class FileOwnershipService implements OnModuleInit {
	private fileService!: file.FileServiceClient;

	constructor(@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	/** 403 unless every file was uploaded by `userId` (legacy files with no uploader don't count). */
	async assertOwnedBy(fileIds: string[], userId: string): Promise<void> {
		if (fileIds.length === 0) return;
		const result = await firstValueFrom(
			this.fileService.checkFilesOwnedBy({ fileIds: fileIds, userId: userId }),
		);
		if (!result.ok)
			throw new ForbiddenException(
				`You can only attach files you uploaded: ${result.foreignIds.join(', ')}`,
			);
	}
}
