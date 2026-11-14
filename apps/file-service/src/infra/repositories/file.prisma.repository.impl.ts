import { IFileRepository } from '../../domain/repositories/file.repository';
import { FileMetadata } from '../../types/file-metadata.type';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/file';

@Injectable()
export class FilePrismaRepositoryImpl implements IFileRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async create(fileMetadata: FileMetadata, isPublic: boolean, uploadedBy: string): Promise<string> {
		const newFile = await this.txHost.tx.file.create({
			data: {
				size: fileMetadata.fileSize,
				name: fileMetadata.fileName,
				mimeType: fileMetadata.contentType,
				isPublic: isPublic,
				uploadedBy: uploadedBy,
			},
		});
		return newFile.id;
	}

	async incrementRef(ids: string[], count = 1): Promise<void> {
		await this.txHost.tx.file.updateMany({
			where: { id: { in: ids } },
			data: { refCount: { increment: count } },
		});
	}

	async decrementRef(files: { id: string; count?: number }[]): Promise<void> {
		// updateMany skips unknown ids (count 0) instead of throwing P2025, so one stale id
		// can't roll back the other decrements. Sequential: they share one transaction.
		for (const { id, count = 1 } of files) {
			await this.txHost.tx.file.updateMany({
				where: { id: id },
				data: { refCount: { decrement: count } },
			});
		}
		// Never below 0: a duplicate removal (e.g. a legacy event with no inbox id) must not leave
		// a debt that swallows the next reference. Same transaction, so the rows are still locked.
		if (files.length === 0) return;
		await this.txHost.tx.file.updateMany({
			where: { id: { in: files.map(f => f.id) }, refCount: { lt: 0 } },
			data: { refCount: 0 },
		});
	}

	async lockOrphanedFiles(
		untouchedSince: Date,
		limit: number,
	): Promise<{ id: string; isPublic: boolean }[]> {
		// `updatedAt` is a UTC timestamp without time zone, so compare against the UTC wall time.
		return await this.txHost.tx.$queryRaw<{ id: string; isPublic: boolean }[]>`
			SELECT "id", "isPublic" FROM "files"
			WHERE "ref_count" <= 0 AND "is_system" = false
				AND "updatedAt" < ${untouchedSince.toISOString()}::timestamp
			ORDER BY "updatedAt"
			LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
	}

	async removeOrphaned(ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.txHost.tx.file.deleteMany({
			where: { id: { in: ids }, refCount: { lte: 0 }, isSystem: false },
		});
	}

	async getFilesPravicySettings(ids: string[]): Promise<{ id: string; isPublic: boolean }[]> {
		return await this.txHost.tx.file.findMany({
			where: { id: { in: ids } },
			select: { id: true, isPublic: true },
		});
	}

	async findIdsUploadedBy(ids: string[], userId: string): Promise<string[]> {
		const rows = await this.txHost.tx.file.findMany({
			where: { id: { in: ids }, uploadedBy: userId },
			select: { id: true },
		});
		return rows.map(r => r.id);
	}
}
