import { achievement } from '@server/generated';
import { IsString } from 'class-validator';

export class GetUsersProgressDto implements achievement.UserProgressRequestDto {
	@IsString()
	userId!: string;
}
