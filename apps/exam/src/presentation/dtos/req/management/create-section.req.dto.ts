import { exam } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSectionDto implements exam.CreateSectionDto {
	@IsOptional()
	@IsString()
	examId?: string;

	@IsInt()
	@IsOptional()
	index?: number;

	@IsOptional()
	@IsString()
	sectionId?: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
