import { CredentialReadModel } from '../../domain/read-models/credential.read-model';
import { type ICredentialReadRepository } from '../../domain/repositories/credential.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/auth';

@Injectable()
export class CredentialReadPrismaRepositoryImpl implements ICredentialReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getCredentialList(identityId: string): Promise<CredentialReadModel[]> {
		return (
			await this.txHost.tx.credential.findMany({
				where: { identityId: identityId },
				select: { id: true, loginType: true },
			})
		).map(c => ({ id: c.id, type: c.loginType }));
	}
}
