import { IRoomRepository } from '../../../domain/repositories/room.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/live';

@Injectable()
export class RoomPrismaRepositoryImpl implements IRoomRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async updateRoomSchedule(
		roomId: string,
		options: { url?: string | null; time?: Date | null },
	): Promise<void> {
		await this.txHost.tx.room.update({
			where: { id: roomId, isDeleted: false },
			data: {
				scheduledLiveUrl: options.url,
				scheduledTime: options.time,
			},
		});
	}

	/** A user may join only an existing, non-deleted room they are not banned from. */
	async canJoinRoom(roomId: string, uid: string): Promise<boolean> {
		const room = await this.txHost.tx.room.findFirst({
			where: { id: roomId, isDeleted: false },
			select: { banneds: { where: { uid: uid }, select: { uid: true } } },
		});
		return !!room && room.banneds.length === 0;
	}

	async createRoom(name: string): Promise<string> {
		try {
			const room = await this.txHost.tx.room.create({
				data: { name: name },
				select: { id: true },
			});
			return room.id;
		} catch (e) {
			// An upsert here used to revive someone else's room (and hand it to the new creator).
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
				throw new ConflictException('A room with this name already exists');
			}
			throw e;
		}
	}

	async removeRoom(roomId: string): Promise<void> {
		// Free the unique name so it can be reused by a brand-new room.
		await this.txHost.tx.room.update({
			where: { id: roomId },
			data: { isDeleted: true, name: `${roomId}:deleted` },
		});
	}

	async banUserFrom(roomId: string, uid: string, reason: string): Promise<void> {
		try {
			await this.txHost.tx.banned.create({
				data: {
					roomId: roomId,
					uid: uid,
					reason: reason,
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
			throw e;
		}
	}

	async unbanUserFrom(roomId: string, uid: string): Promise<void> {
		try {
			await this.txHost.tx.banned.delete({
				where: {
					roomId_uid: {
						roomId: roomId,
						uid: uid,
					},
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return;
			throw e;
		}
	}

	async saveLog(
		roomId: string,
		fromId: string,
		message: string,
	): Promise<{ id: string; createdAt: Date }> {
		const room = await this.txHost.tx.room.findFirst({
			where: { id: roomId, isDeleted: false },
			select: { id: true },
		});
		if (!room) throw new NotFoundException('Room not found');
		const log = await this.txHost.tx.log.create({
			data: { roomId: roomId, fromId: fromId, message: message },
			select: { id: true, createdAt: true },
		});
		return log;
	}
}
