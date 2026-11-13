import { type ChatLog } from '../../../domain/read-model/chat-log.read-model';
import { Room } from '../../../domain/read-model/room.read-model';
import { IRoomReadRepository } from '../../../domain/repositories/room.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/live';

class RoomReadPrismaMapper {
	static toReadModel(this: void, from: Prisma.RoomGetPayload<{}>): Room {
		return {
			id: from.id,
			name: from.name,
			scheduledLiveUrl: from.scheduledLiveUrl ?? undefined,
			// named like the API field (`scheduledDate`); it used to be `scheduledTime` here and was
			// silently dropped by the response DTO
			scheduledDate: from.scheduledTime ?? undefined,
			createdBy: from.createdBy ?? undefined,
		};
	}
}

@Injectable()
export class RoomReadPrismaRepositoryImpl implements IRoomReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getRoomList(options?: {
		id?: string;
		direction?: number;
		limit?: number;
	}): Promise<Room[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const limit = options?.limit ?? 20;
		const direction = Math.sign(options?.direction || 1);
		const rooms = await this.txHost.tx.room.findMany({
			where: { isDeleted: false },
			orderBy: { id: 'asc' },
			...(options?.id && {
				cursor: { id: options.id },
				skip: 1,
			}),
			take: direction * limit,
		});

		const lastMessages = await this.lastMessagesOf(rooms.map(r => r.id));
		return rooms.map(room => ({
			...RoomReadPrismaMapper.toReadModel(room),
			lastMessage: lastMessages.get(room.id),
		}));
	}

	/** The newest message of each room, in one query (Prisma `distinct` keeps the first per room). */
	private async lastMessagesOf(roomIds: string[]): Promise<Map<string, ChatLog>> {
		if (roomIds.length === 0) return new Map();
		const logs = await this.txHost.tx.log.findMany({
			where: { roomId: { in: roomIds } },
			orderBy: [{ roomId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
			distinct: ['roomId'],
			select: { id: true, roomId: true, fromId: true, message: true, createdAt: true },
		});
		return new Map(
			logs.map(log => [
				log.roomId,
				{ id: log.id, uid: log.fromId, message: log.message, createdAt: log.createdAt },
			]),
		);
	}
}
