import { file } from '@server/generated';
import { Expose } from 'class-transformer';

export class FilesOwnershipDto implements file.CheckFilesOwnedByResponse {
	@Expose()
	ok!: boolean;

	@Expose()
	foreignIds!: string[];
}
