import {
	type IBadgeManagerRepository,
	IBadgeManagerRepositoryToken,
} from '../../../domain/repositories/badge-manager.repository';
import {
	RabbitPayload,
	RabbitSubscribe,
	defaultNackErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';
import { Type } from 'class-transformer';
import { IsDate, IsString } from 'class-validator';

class LoginEvent {
	@IsString()
	uid!: string;

	@Type(() => Date)
	@IsDate()
	date!: Date;
}

@Injectable()
export class LoginHandler {
	constructor(
		@Inject(IBadgeManagerRepositoryToken)
		private readonly badgeManagerRepository: IBadgeManagerRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'auth.user.login',
		queue: 'achievement.events.user.login',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'achievement.dlx',
			deadLetterRoutingKey: 'user.login.failed',
		},
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: LoginEvent) {
		try {
			const loginBadgeManager = await this.badgeManagerRepository.getLoginBadgeManager(payload.uid);
			loginBadgeManager.updateProgress(payload.date);
			await this.badgeManagerRepository.saveLoginBadgeManager(loginBadgeManager);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
