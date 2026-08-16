import { IdentityAvatarUpdatedEvent } from '../../../domain/events/identity-update.events';
import { FileAddedIntegrationEvent } from '../file-added.event';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { InternalServerErrorException } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@EventsHandler(IdentityAvatarUpdatedEvent)
export class FileAddedPublisher implements IEventHandler<IdentityAvatarUpdatedEvent> {
	constructor(
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {}

	get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	async handle(event: IdentityAvatarUpdatedEvent) {
		if (!event.payload.avatarFileId) return;
		try {
			const message: FileAddedIntegrationEvent = {
				fileId: event.payload.avatarFileId,
			};
			await this.amqpConnection.publish('eventbus', 'auth.file.added', message, {
				persistent: true,
			});
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
