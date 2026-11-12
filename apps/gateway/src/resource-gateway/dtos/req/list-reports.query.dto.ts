import { PageQueryDto } from './page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListReportsQueryDto extends PageQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Only honoured for moderators/admins' })
	reportedBy?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	type?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	status?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	targetType?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	targetId?: string;
}
