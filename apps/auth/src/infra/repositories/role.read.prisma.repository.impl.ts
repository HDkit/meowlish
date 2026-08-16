import { RoleReadModel } from '../../domain/read-models/role.read-model';
import { type IRoleReadRepository } from '../../domain/repositories/role.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/auth';

@Injectable()
export class RoleReadPrismaRepositoryImpl implements IRoleReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getPermList(): Promise<string[]> {
		return (await this.txHost.tx.permission.findMany({ select: { name: true } })).map(p => p.name);
	}

	async getRoleList(): Promise<RoleReadModel[]> {
		const roles = await this.txHost.tx.role.findMany({
			select: {
				id: true,
				name: true,
				rolePermissions: { select: { permission: { select: { name: true } } } },
			},
		});
		return roles.map(r => ({
			id: r.id,
			name: r.name,
			permissions: r.rolePermissions.map(p => p.permission.name),
		}));
	}
}
