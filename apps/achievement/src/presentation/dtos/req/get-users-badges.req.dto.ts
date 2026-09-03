import { achievement } from '@server/generated';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class GetUsersBadgesDto implements achievement.UserBadgesRequestDto {
	@IsString()
	userId!: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	limit?: number;
}
