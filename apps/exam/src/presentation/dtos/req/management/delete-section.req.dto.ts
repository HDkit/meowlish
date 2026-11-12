import { exam } from '@server/generated';
import { IsBoolean, IsString } from 'class-validator';

export class DeleteSectionDto implements exam.DeleteSectionDto {
	@IsString()
	id!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
