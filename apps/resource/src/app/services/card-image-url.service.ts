import { FILE_CLIENT } from '../../constants/file';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

/** Something showing a card image: `image` is filled in from `imageFileId`. */
export interface CardImageView {
	image?: string;
	imageFileId?: string;
}

/**
 * Turns card image file ids into URLs the browser can load, with one `GetUrls` call per response.
 * Card images are uploaded to the public bucket (like avatars and exam media), so the URLs don't
 * expire. Cards with only a legacy URL keep it. Runs outside transactions (it is a gRPC call).
 */
@Injectable()
export class CardImageUrlService implements OnModuleInit {
	private readonly logger = new Logger(CardImageUrlService.name);
	private fileService!: file.FileServiceClient;

	constructor(@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc) {}

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}

	/**
	 * Sets `image` on every item with an `imageFileId` (in place). A file file-service doesn't
	 * know leaves `image` absent; if file-service is down the images are left out rather than
	 * failing the whole read.
	 */
	async resolve(items: readonly (CardImageView | null | undefined)[]): Promise<void> {
		const withFile = items.filter((i): i is CardImageView => !!i?.imageFileId);
		if (withFile.length === 0) return;
		const ids = [...new Set(withFile.map(i => i.imageFileId))].filter((id): id is string => !!id);
		let urls: Record<string, string> = {};
		try {
			urls = (await firstValueFrom(this.fileService.getUrls({ ids: ids }))).urls;
		} catch (err: unknown) {
			this.logger.warn(`Could not resolve card image URLs: ${String(err)}`);
		}
		for (const item of withFile) item.image = item.imageFileId ? urls[item.imageFileId] : undefined;
	}
}
