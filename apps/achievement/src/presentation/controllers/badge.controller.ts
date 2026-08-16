import { GetBadgesQuery } from '../../app/queries/achievement.get-badges.query';
import { GetUsersBadgesQuery } from '../../app/queries/achievement.get-users-badges.query';
import { GetUsersProgressQuery } from '../../app/queries/achievement.get-users-progress.query';
import { GetUsersBadgesDto } from '../dtos/req/get-users-badges.req.dto';
import { GetUsersProgressDto } from '../dtos/req/get-users-progress.req.dto';
import { FoundBadgesDto } from '../dtos/res/found-badges.res.dto';
import { FoundUsersBadgesDto } from '../dtos/res/found-users-badges.res.dto';
import { ProgressDto } from '../dtos/res/progress.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Payload } from '@nestjs/microservices';
import { achievement } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@achievement.AchievementServiceControllerMethods()
@Controller()
export class BadgeController implements achievement.AchievementServiceController {
	constructor(private readonly queryBus: QueryBus) {}

	@SerializeOptions({ type: FoundBadgesDto })
	async getAll(): Promise<FoundBadgesDto> {
		return await this.queryBus.execute(new GetBadgesQuery());
	}

	@SerializeOptions({ type: FoundUsersBadgesDto })
	async getUsersBadges(@Payload() request: GetUsersBadgesDto): Promise<FoundUsersBadgesDto> {
		return await this.queryBus.execute(new GetUsersBadgesQuery(request));
	}

	@SerializeOptions({ type: ProgressDto })
	async getUsersProgess(@Payload() request: GetUsersProgressDto): Promise<ProgressDto> {
		return await this.queryBus.execute(new GetUsersProgressQuery(request));
	}
}
