import { BadgeDto } from './found-badges.res.dto';
import { achievement } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class FoundUsersBadgesDto implements achievement.UserBadgesResponseDto {
	@Expose()
	@Type(() => UserBadgeDto)
	badges!: UserBadgeDto[];

	@Expose()
	nextCursor?: string;

	@Expose()
	prevCursor?: string;
}

export class UserBadgeDto extends BadgeDto implements achievement.UserBadges {
	@Expose()
	id!: string;

	@Expose()
	date!: Date;
}
