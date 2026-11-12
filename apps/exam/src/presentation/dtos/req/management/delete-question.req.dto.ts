import { exam } from '@server/generated';
import { IsBoolean, IsString } from 'class-validator';

export class DeleteQuestionDto implements exam.DeleteQuestionDto {
	@IsString()
	id!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
