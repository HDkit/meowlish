import { FilePreviewDto } from './file-preview.res.dto';
import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class SectionManagementInfoDto implements exam.SectionManagementInfo {
	@Expose()
	contentType!: string;

	@Expose()
	directive!: string;

	@Expose()
	examId!: string;

	@Expose()
	@Type(() => FilePreviewDto)
	files!: FilePreviewDto[];

	@Expose()
	id!: string;

	@Expose()
	name?: string;

	@Expose()
	parentId?: string;

	@Expose()
	childrenIds!: string[];

	@Expose()
	tags!: string[];
}
