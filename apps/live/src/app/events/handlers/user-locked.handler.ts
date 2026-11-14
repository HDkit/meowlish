import { ChatGateway } from '../../services/chat.gateway';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const USER_LOCKED_QUEUE = defineConsumerQueue('live.events.user.locked');

class UserLockedEvent {
	@IsString() identityId!: string;
}

/**
 * A locked account must lose its open chat sockets at once: the connect-time check only refuses
 * new ones, and an open socket would otherwise keep working until it reconnects.
 */
@Injectable()
export class UserLockedHandler {
	constructor(
		private readonly chatGateway: ChatGateway,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'auth.user.locked',
		...USER_LOCKED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, USER_LOCKED_QUEUE.name))) return;
		const event = await validatePayload(UserLockedEvent, payload);
		await this.chatGateway.disconnectAllOf(event.identityId);
	}
}
