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
			scheduledTime: from.scheduledTime ?? undefined,
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

		return rooms.map(RoomReadPrismaMapper.toReadModel);
	}
}
