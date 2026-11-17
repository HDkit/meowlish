import { exam } from '@server/generated';
import { IsBoolean, IsString } from 'class-validator';

export class DeleteExamDto implements exam.DeleteExamDto {
	@IsString()
	id!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
