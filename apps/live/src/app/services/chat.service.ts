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
import { Transactional } from '@nestjs-cls/transactional';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { CursorPaginationFactory, CursorPaginationHelper } from '@server/utils';

@Injectable()
export class ChatService {
	private readonly cursorPaginationHelpers: Record<
		'getRoomList' | 'getChatLogsOf',
		CursorPaginationHelper
	>;

	constructor(
		cursorPaginationFactory: CursorPaginationFactory,
		private readonly chatGateway: ChatGateway,
		@Inject(IChatLogReadRepositoryToken)
		private readonly chatLogReadRepository: IChatLogReadRepository,
		@Inject(IRoomReadRepositoryToken)
		private readonly roomReadRepository: IRoomReadRepository,
		@Inject(IRoomRepositoryToken)
		private readonly roomRepository: IRoomRepository,
		private readonly outbox: OutboxPublisher,
	) {
		this.cursorPaginationHelpers = {
			getRoomList: cursorPaginationFactory.create('GetRoomList'),
			getChatLogsOf: cursorPaginationFactory.create('GetChatLogsOf'),
		};
	}

	async getRoomList(options?: {
		cursor?: string;
		limit?: number;
		name?: string;
	}): Promise<{ rooms: Room[]; nextCursor: string; prevCursor: string }> {
		type DecodedCursor = { id?: string; direction: number; limit: number; name?: string };
		const helper = this.cursorPaginationHelpers['getRoomList'];
		const decodedCursor =
			options?.cursor ? helper.decodeCursor<DecodedCursor>(options.cursor) : undefined;

		const inUseId = decodedCursor?.id;
		const inUseLimit = options?.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;
		// the cursor's filter has precedence, so paging can never drift to another filter
		const inUseName = decodedCursor ? decodedCursor.name : options?.name?.trim() || undefined;

		// one extra row tells whether there is a page beyond this one
		const fetched = await this.roomReadRepository.getRoomList({
			id: inUseId,
			direction: direction,
			limit: inUseLimit + 1,
			name: inUseName,
		});
		const more = fetched.length > inUseLimit;
		// a backward page comes back in ascending order ending just before the cursor: the extra row is first
		const rooms = direction === -1 ? fetched.slice(-inUseLimit) : fetched.slice(0, inUseLimit);
		const hasNext = direction === -1 ? true : more;
		const hasPrev = direction === -1 ? more : !!inUseId;

		const encode = (id: string | undefined, dir: number) =>
			helper.encodeCursor<DecodedCursor>({
				id: id,
				direction: dir,
				limit: inUseLimit,
				name: inUseName,
			});

		return {
			rooms: rooms,
			// empty when there is no such page, so clients can disable the button
			nextCursor: hasNext && rooms.length > 0 ? encode(rooms.at(-1)?.id, 1) : '',
			prevCursor: hasPrev && rooms.length > 0 ? encode(rooms.at(0)?.id, -1) : '',
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
			uid?: string;
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
		const inUseUid = decodedCursor?.uid ?? options?.uid;
		const inUseLimit = options?.limit ?? decodedCursor?.limit ?? 10;
		const direction = decodedCursor?.direction ?? 1;

		const chats = await this.chatLogReadRepository.getChatLogsOf(roomId, {
			id: inUseId,
			uid: inUseUid,
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
			uid: inUseUid,
		});
		const encodedPrevCursor = this.cursorPaginationHelpers[
			'getChatLogsOf'
		].encodeCursor<DecodedCursor>({
			id: chats.at(0)?.id,
			direction: -1,
			limit: inUseLimit,
			dateRange: inUseDateRange,
			uid: inUseUid,
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

	@Transactional()
	async createRoom(name: string, createdBy?: string): Promise<string> {
		const roomId = await this.roomRepository.createRoom(name, createdBy);

		if (createdBy) {
			await this.outbox.add('live.room.created', {
				resourceType: 'room',
				resourceId: roomId,
				ownerId: createdBy,
			});
		}

		return roomId;
	}

	@Transactional()
	async removeRoom(roomId: string): Promise<void> {
		await this.roomRepository.removeRoom(roomId);
		this.chatGateway.closeRoom(roomId);
		await this.outbox.add('live.room.deleted', { resourceId: roomId });
	}

	/** 404 when the room is missing; 403 unless the requester owns it or is privileged (rooms with no owner: privileged only). */
	private async assertCanModerate(
		roomId: string,
		who: { requesterId: string; privileged: boolean },
	): Promise<void> {
		const owner = await this.roomRepository.getRoomOwner(roomId);
		if (owner === undefined) throw new NotFoundException('Room not found');
		if (!who.privileged && owner !== who.requesterId)
			throw new ForbiddenException('Only the room owner or an admin can moderate this room');
	}

	async banUserFrom(
		roomId: string,
		uid: string,
		reason: string,
		who: { requesterId: string; privileged: boolean },
	): Promise<void> {
		await this.assertCanModerate(roomId, who);
		this.chatGateway.disconnectUser(uid, roomId);
		await this.roomRepository.banUserFrom(roomId, uid, reason);
	}

	async unbanUserFrom(
		roomId: string,
		uid: string,
		who: { requesterId: string; privileged: boolean },
	): Promise<void> {
		await this.assertCanModerate(roomId, who);
		await this.roomRepository.unbanUserFrom(roomId, uid);
	}
}
