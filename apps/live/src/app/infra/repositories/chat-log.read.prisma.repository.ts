import { ChatLog } from '../../../domain/read-model/chat-log.read-model';
import { IChatLogReadRepository } from '../../../domain/repositories/chat-log.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/live';

class ChatLogPrismaMapper {
	static toReadModel(
		this: void,
		from: {
			id: string;
			fromId: string;
			message: string;
			createdAt: Date;
		},
	): ChatLog {
		return {
			id: from.id,
			uid: from.fromId,
			message: from.message,
			createdAt: from.createdAt,
		};
	}
}

@Injectable()
export class ChatLogReadPrismaRepositoryImpl implements IChatLogReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getChatLogsOf(
		roomId: string,
		options?: {
			uid?: string;
			id?: string;
			direction?: number;
			limit?: number;
			dateRange?: { from: Date; to: Date };
		},
	): Promise<ChatLog[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const limit = options?.limit ?? 20;
		const direction = Math.sign(options?.direction || 1);
		const logs = await this.txHost.tx.log.findMany({
			where: {
				roomId: roomId,
				room: { isDeleted: false },
				...(options?.uid && { fromId: options.uid }),
				...(options?.dateRange && {
					createdAt: {
						gte: options.dateRange.from,
						lte: options.dateRange.to,
					},
				}),
			},
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
			...(options?.id && {
				cursor: { id: options.id },
				skip: 1,
			}),
			take: limit * direction,
		});

		return logs.map(ChatLogPrismaMapper.toReadModel);
	}
}
