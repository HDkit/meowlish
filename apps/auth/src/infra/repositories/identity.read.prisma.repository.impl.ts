import {
	HydratedIdentityReadModel,
	IdentityReadModel,
} from '../../domain/read-models/identity.read-model';
import { type IIdentityReadRepository } from '../../domain/repositories/identity.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/auth';

@Injectable()
export class IdentityReadPrismaRepositoryImpl implements IIdentityReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async findIdentityIds(options?: {
		usernameOrCredentialIdentifier?: string;
		lastId?: string;
		limit?: number;
	}): Promise<string[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');
		const foundIdentities = await this.txHost.tx.identity.findMany({
			where: {
				...(options?.usernameOrCredentialIdentifier && {
					OR: [
						{ username: { contains: options.usernameOrCredentialIdentifier } },
						{
							credentials: {
								some: { identifier: { contains: options.usernameOrCredentialIdentifier } },
							},
						},
					],
				}),
			},
			orderBy: { id: 'asc' },
			select: { id: true },
			...(options?.lastId && { cursor: { id: options.lastId }, skip: 1 }),
			take: options?.limit ?? 10,
		});
		return foundIdentities.map(i => i.id);
	}

	// raw SQL join might be better without processing in-app but time is of the essence
	async findIdentities(options?: {
		usernameOrCredentialIdentifierOrId?: string;
		hasRoles?: string[];
		hasPerms?: string[];
		lastId?: string;
		limit?: number;
	}): Promise<IdentityReadModel[]> {
		if (options?.limit && options.limit < 0)
			throw new BadRequestException('Limit must be positive');

		const roleOr: Prisma.IdentityWhereInput[] = [];
		if (options?.hasRoles?.length) {
			roleOr.push({
				identityRoles: {
					some: {
						role: {
							name: { in: options.hasRoles },
						},
					},
				},
			});
		}
		if (options?.hasPerms?.length) {
			roleOr.push({
				identityRoles: {
					some: {
						role: {
							rolePermissions: {
								some: {
									permission: {
										name: { in: options.hasPerms },
									},
								},
							},
						},
					},
				},
			});
		}

		const foundIdentities = await this.txHost.tx.identity.findMany({
			where: {
				...(options?.usernameOrCredentialIdentifierOrId && {
					OR: [
						{ username: { contains: options.usernameOrCredentialIdentifierOrId } },
						{
							credentials: {
								some: { identifier: { contains: options.usernameOrCredentialIdentifierOrId } },
							},
						},
						{ id: { contains: options.usernameOrCredentialIdentifierOrId } },
					],
				}),
				...(roleOr.length && {
					OR: roleOr,
				}),
			},
			orderBy: { id: 'asc' },
			select: {
				id: true,
				identityRoles: {
					select: {
						role: { select: { name: true, rolePermissions: { select: { permission: true } } } },
					},
				},
				username: true,
				fullName: true,
				avatarFileId: true,
				bio: true,
			},
			...(options?.lastId && { cursor: { id: options.lastId }, skip: 1 }),
			take: options?.limit ?? 10,
		});
		return foundIdentities.map(i => ({
			id: i.id,
			username: i.username,
			fullName: i.fullName ?? undefined,
			avatarUrl: i.avatarFileId ?? undefined,
			bio: i.bio ?? undefined,
			roles: i.identityRoles.map(rIdentityRole => rIdentityRole.role.name),
			permissions: [
				...new Set<string>(
					i.identityRoles.flatMap(rIdentityRole =>
						rIdentityRole.role.rolePermissions.map(rPermission => rPermission.permission.name),
					),
				),
			],
		}));
	}

	async hydrate(id: string): Promise<HydratedIdentityReadModel | null> {
		const foundIdentity = await this.txHost.tx.identity.findUnique({
			where: { id: id },
			select: {
				id: true,
				username: true,
				fullName: true,
				avatarFileId: true,
				bio: true,
			},
		});
		return foundIdentity ?
				{
					id: foundIdentity.id,
					username: foundIdentity.username,
					fullName: foundIdentity.fullName ?? undefined,
					avatarUrl: foundIdentity.avatarFileId ?? undefined,
					bio: foundIdentity.bio ?? undefined,
				}
			:	null;
	}

	async hydrateMany(ids: string[]): Promise<HydratedIdentityReadModel[]> {
		const foundIdentities = await this.txHost.tx.identity.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				username: true,
				fullName: true,
				avatarFileId: true,
				bio: true,
			},
		});

		return foundIdentities.map(i => ({
			id: i.id,
			username: i.username,
			fullName: i.fullName ?? undefined,
			avatarUrl: i.avatarFileId ?? undefined,
			bio: i.bio ?? undefined,
		}));
	}
}
