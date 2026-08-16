import { IFileRepository } from '../../domain/repositories/file.repository';
import { FileMetadata } from '../../types/file-metadata.type';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/file';

@Injectable()
export class FilePrismaRepositoryImpl implements IFileRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async create(fileMetadata: FileMetadata, isPublic: boolean): Promise<string> {
		const newFile = await this.txHost.tx.file.create({
			data: {
				size: fileMetadata.fileSize,
				name: fileMetadata.fileName,
				mimeType: fileMetadata.contentType,
				isPublic: isPublic,
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
		await Promise.all(
			files.map(({ id, count = 1 }) =>
				this.txHost.tx.file.update({
					where: { id: id },
					data: {
						refCount: { decrement: count },
					},
				}),
			),
		);
	}

	async remove(ids: string[]): Promise<void> {
		await this.txHost.tx.file.deleteMany({ where: { id: { in: ids } } });
	}

	async getOrphanedFiles(): Promise<{ id: string; isPublic: boolean; updatedAt: Date }[]> {
		return await this.txHost.tx.file.findMany({
			where: {
				refCount: { lte: 0 },
				NOT: { name: { startsWith: 'SYSTEM_', mode: 'insensitive' } },
			},
			select: { id: true, isPublic: true, updatedAt: true },
		});
	}

	async getFilesPravicySettings(ids: string[]): Promise<{ id: string; isPublic: boolean }[]> {
		return await this.txHost.tx.file.findMany({
			where: { id: { in: ids } },
			select: { id: true, isPublic: true },
		});
	}
}
