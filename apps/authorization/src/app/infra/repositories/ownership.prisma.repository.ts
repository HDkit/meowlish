import { IOwnershipRepository } from '../../../domain/repositories/ownership.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/authorization';

@Injectable()
export class OwnershipPrismaRepositoryImpl implements IOwnershipRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async checkOwnership(resourceType: string, resourceId: string, userId: string): Promise<boolean> {
		const record = await this.txHost.tx.resourceOwnership.findUnique({
			where: { resourceType_resourceId: { resourceType: resourceType, resourceId: resourceId } },
			select: { ownerId: true },
		});
		return record?.ownerId === userId;
	}

	async registerOwnership(
		resourceType: string,
		resourceId: string,
		ownerId: string,
	): Promise<void> {
		try {
			await this.txHost.tx.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: resourceType, resourceId: resourceId } },
				update: { ownerId: ownerId },
				create: { resourceType: resourceType, resourceId: resourceId, ownerId: ownerId },
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
			throw e;
		}
	}

	async removeOwnership(resourceType: string, resourceId: string): Promise<void> {
		try {
			await this.txHost.tx.resourceOwnership.delete({
				where: { resourceType_resourceId: { resourceType: resourceType, resourceId: resourceId } },
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return;
			throw e;
		}
	}
}
