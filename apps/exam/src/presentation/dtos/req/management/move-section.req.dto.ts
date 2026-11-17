import { exam } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class MoveSectionDto implements exam.MoveSectionDto {
	@IsString()
	id!: string;

	@IsInt()
	@IsOptional()
	index?: number;

	@IsOptional()
	@IsString()
	parentId?: string;

	@IsBoolean()
	@IsOptional()
	toRoot?: boolean;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
