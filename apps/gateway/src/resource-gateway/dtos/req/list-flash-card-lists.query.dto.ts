import { PageQueryDto } from './page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToStringArray, str2bool } from '@server/utils';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListFlashCardListsQueryDto extends PageQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	authorId?: string;

	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? (str2bool(value) ?? value) : value,
	)
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean })
	isPublic?: boolean;

	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	@ToStringArray()
	tags: string[] = [];
}
