import { IdentityLockedEvent } from '../../../domain/events/identity-update.events';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { InternalServerErrorException } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@EventsHandler(IdentityLockedEvent)
export class IdentityLockedPublisher implements IEventHandler<IdentityLockedEvent> {
	constructor(
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {}

	get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	async handle(event: IdentityLockedEvent) {
		try {
			await this.amqpConnection.publish(
				'eventbus',
				'auth.user.locked',
				{
					identityId: event.payload.identityId,
					lockedBy: event.payload.lockedBy,
				},
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
