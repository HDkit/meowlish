import { IFileRepository } from '../../domain/repositories/file.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/auth';

@Injectable()
export class FilePrismaRepositoryImpl implements IFileRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getAndRemoveDeletedFileIds(limit = 100): Promise<{ id: string; count: number }[]> {
		return this.txHost.withTransaction(async () => {
			const rows = await this.txHost.tx.$queryRaw<{ id: string; count: number }[]>`
			DELETE FROM deleted_files
			WHERE file_id IN (
				SELECT file_id
				FROM deleted_files
				FOR UPDATE SKIP LOCKED
				LIMIT ${limit}
			)
			RETURNING
				file_id AS id,
				count;
		`;

			return rows;
		});
	}
}
