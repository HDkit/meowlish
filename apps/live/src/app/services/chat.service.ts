import { ChatLog } from '../../domain/read-model/chat-log.read-model';
import { Room } from '../../domain/read-model/room.read-model';
import {
	type IChatLogReadRepository,
	IChatLogReadRepositoryToken,
} from '../../domain/repositories/chat-log.read.repository';
import {
	type IRoomReadRepository,
	IRoomReadRepositoryToken,
} from '../../domain/repositories/room.read.repository';
import {
	type IRoomRepository,
	IRoomRepositoryToken,
} from '../../domain/repositories/room.repository';
import { ChatGateway } from './chat.gateway';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { CursorPaginationHelper } from '@server/utils';

@Injectable()
export class ChatService {
	private readonly cursorPaginationHelpers: Record<
		'getRoomList' | 'getChatLogsOf',
		CursorPaginationHelper
	>;

	constructor(
		private readonly chatGateway: ChatGateway,
		@Inject(IChatLogReadRepositoryToken)
		private readonly chatLogReadRepository: IChatLogReadRepository,
		@Inject(IRoomReadRepositoryToken)
		private readonly roomReadRepository: IRoomReadRepository,
		@Inject(IRoomRepositoryToken)
		private readonly roomRepository: IRoomRepository,
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {
		this.cursorPaginationHelpers = {
			getRoomList: new CursorPaginationHelper(`${process.env.HOST}${process.env.PORT}GetRoomList`),
			getChatLogsOf: new CursorPaginationHelper(
				`${process.env.HOST}${process.env.PORT}GetChatLogsOf`,
			),
		};
	}

	private get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	async getRoomList(options?: {
		cursor?: string;
		limit?: number;
	}): Promise<{ rooms: Room[]; nextCursor: string; prevCursor: string }> {
		type DecodedCursor = { id?: string; direction: number; limit: number };
		const decodedCursor =
			options?.cursor ?
				this.cursorPaginationHelpers['getRoomList'].decodeCursor<DecodedCursor>(options.cursor)
			:	undefined;

		const inUseId = decodedCursor?.id;
		const inUseLimit = options?.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const rooms = await this.roomReadRepository.getRoomList({
			id: inUseId,
			direction: direction,
			limit: inUseLimit,
		});
		const encodedNextCursor = this.cursorPaginationHelpers[
			'getRoomList'
		].encodeCursor<DecodedCursor>({
			id: rooms.at(-1)?.id,
			direction: 1,
			limit: inUseLimit,
		});
		const encodedPrevCursor = this.cursorPaginationHelpers[
			'getRoomList'
		].encodeCursor<DecodedCursor>({
			id: rooms.at(0)?.id,
			direction: -1,
			limit: inUseLimit,
		});

		return {
			rooms: rooms,
			nextCursor: encodedNextCursor,
			prevCursor: encodedPrevCursor,
		};
	}

	async getChatLogsOf(
		roomId: string,
		options?: {
			uid?: string;
			cursor?: string;
			limit?: number;
			dateRange?: { from: Date; to: Date };
		},
	): Promise<{ chats: ChatLog[]; nextCursor: string; prevCursor: string }> {
		type DecodedCursor = {
			id?: string;
			direction: number;
			limit: number;
			dateRange?: { from: Date; to: Date };
		};
		const decodedCursor =
			options?.cursor ?
				this.cursorPaginationHelpers['getChatLogsOf'].decodeCursor<DecodedCursor>(options.cursor)
			:	undefined;

		const inUseId = decodedCursor?.id;
		const inUseDateRange = decodedCursor?.dateRange ?? options?.dateRange;
		const inUseLimit = options?.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const chats = await this.chatLogReadRepository.getChatLogsOf(roomId, {
			id: inUseId,
			direction: direction,
			limit: inUseLimit,
			dateRange: inUseDateRange,
		});
		const encodedNextCursor = this.cursorPaginationHelpers[
			'getChatLogsOf'
		].encodeCursor<DecodedCursor>({
			id: chats.at(-1)?.id,
			direction: 1,
			limit: inUseLimit,
			dateRange: inUseDateRange,
		});
		const encodedPrevCursor = this.cursorPaginationHelpers[
			'getChatLogsOf'
		].encodeCursor<DecodedCursor>({
			id: chats.at(0)?.id,
			direction: -1,
			limit: inUseLimit,
			dateRange: inUseDateRange,
		});

		return {
			chats: chats,
			nextCursor: encodedNextCursor,
			prevCursor: encodedPrevCursor,
		};
	}

	async updateRoomSchedule(
		roomId: string,
		options: { url?: string; time?: Date; setUrlNull?: boolean; setTimeNull?: boolean },
	): Promise<void> {
		await this.roomRepository.updateRoomSchedule(roomId, {
			url: options.setUrlNull ? null : options.url,
			time: options.setTimeNull ? null : options.time,
		});
	}

	async createRoom(name: string, createdBy?: string): Promise<string> {
		const roomId = await this.roomRepository.createRoom(name);

		if (createdBy) {
			try {
				await this.amqpConnection.publish(
					'eventbus',
					'live.room.created',
					{ resourceType: 'room', resourceId: roomId, ownerId: createdBy },
					{ persistent: true },
				);
			} catch (e) {
				this.logger.error(`Failed to publish live.room.created event: ${e}`);
			}
		}

		return roomId;
	}

	async removeRoom(roomId: string): Promise<void> {
		await this.roomRepository.removeRoom(roomId);

		try {
			await this.amqpConnection.publish(
				'eventbus',
				'live.room.deleted',
				{ resourceId: roomId },
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(`Failed to publish live.room.deleted event: ${e}`);
		}
	}

	async banUserFrom(roomId: string, uid: string, reason: string): Promise<void> {
		this.chatGateway.disconnectUser(uid, roomId);
		await this.roomRepository.banUserFrom(roomId, uid, reason);
	}

	async unbanUserFrom(roomId: string, uid: string): Promise<void> {
		await this.roomRepository.unbanUserFrom(roomId, uid);
	}
}
