import { IRoomRepository } from '../../../domain/repositories/room.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
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

	async canJoinRoom(roomId: string, uid: string): Promise<boolean> {
		const isBanned = await this.txHost.tx.banned.findUnique({
			where: { roomId_uid: { roomId: roomId, uid: uid }, room: { isDeleted: false } },
			select: {},
		});

		if (!isBanned) return true;
		return false;
	}

	async createRoom(name: string): Promise<string> {
		const room = await this.txHost.tx.room.upsert({
			where: { name: name },
			update: { isDeleted: false },
			create: { name: name },
			select: { id: true },
		});
		return room.id;
	}

	async removeRoom(roomId: string): Promise<void> {
		await this.txHost.tx.room.update({
			where: { id: roomId },
			data: { isDeleted: true },
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
		const log = await this.txHost.tx.log.create({
			data: { roomId, fromId, message },
			select: { id: true, createdAt: true },
		});
		return log;
	}
}
