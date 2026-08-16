import { FilePreviewDto } from './file-preview.res.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class SectionManagementInfoDto {
	@Expose()
	@ApiProperty()
	contentType!: string;

	@Expose()
	@ApiProperty()
	directive!: string;

	@Expose()
	@ApiProperty()
	examId!: string;

	@Expose()
	@Type(() => FilePreviewDto)
	@ApiProperty({ type: () => [FilePreviewDto] })
	files!: FilePreviewDto[];

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional()
	name?: string;

	@Expose()
	@ApiPropertyOptional()
	parentId?: string;

	@Expose()
	@ApiProperty({ type: [String] })
	childrenIds!: string[];

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];
}
