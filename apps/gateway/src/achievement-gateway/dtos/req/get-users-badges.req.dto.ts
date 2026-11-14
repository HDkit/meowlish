import { ApiPropertyOptional } from '@nestjs/swagger';
import { achievement } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Max } from 'class-validator';

/** Largest page a caller may ask for (the route is public on `GET /badges/:uid`). */
export const MAX_USERS_BADGES_LIMIT = 100;

export class GetUsersBadgesDto implements Omit<achievement.UserBadgesRequestDto, 'userId'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(MAX_USERS_BADGES_LIMIT)
	@ApiPropertyOptional({ type: Number, minimum: 1, maximum: MAX_USERS_BADGES_LIMIT, default: 10 })
	limit?: number;
}
