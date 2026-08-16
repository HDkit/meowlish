import { Credential } from '../../domain/entities/credential.entity';
import { Identity } from '../../domain/entities/identity.entity';
import {
	CredAddedEvent,
	CredDeletedEvent,
	CredUpdatedEvent,
	RoleAddedEvent,
	RoleDeletedEvent,
} from '../../domain/events/identity-update.events';
import { IIdentityRepository } from '../../domain/repositories/identity.repository';
import { LoginType } from '../../enums/login-type.enum';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConflictException, Injectable } from '@nestjs/common';
import {
	Prisma,
	PrismaClient,
	Credential as PrismaCredential,
	Identity as PrismaIdentity,
} from '@prisma-client/auth';
import { Permission, Role } from '@server/typing';
import { parseEnum } from '@server/utils';
import { Event } from '@server/utils';

class IdentityPrismaMapper {
	static mapPermission(from: string): Permission {
		return parseEnum(Permission, from);
	}

	static mapRole(from: string): Role {
		return parseEnum(Role, from);
	}

	static mapLoginType(from: string): LoginType {
		return parseEnum(LoginType, from);
	}

	static toIdentityOrm(from: Identity): RepoIdentity {
		return {
			id: from.id,
			version: from.version,
			username: from.username,
			fullName: from.fullName,
			bio: from.bio,
			avatarFileId: from.avatarFileId,
			deletedAt: from.deletedAt,
		};
	}

	static toCredentialOrm(from: Credential, identityId: string): PrismaCredential {
		return {
			id: from.id,
			identifier: from.identifier,
			loginType: this.mapLoginType(from.loginType),
			secretHash: from.secretHash,
			identityId: identityId,
		};
	}

	static toIdentityAggregate(from: ExtendedIdentity): Identity {
		return new Identity({
			id: from.id,
			version: from.version,
			username: from.username,
			fullName: from.fullName,
			bio: from.bio,
			avatarFileId: from.avatarFileId,
			createdAt: from.createdAt,
			deletedAt: from.deletedAt,
			updatedAt: from.updatedAt,
			roleIds: from.identityRoles.map(r => r.roleId),
			credentials: from.credentials.map(
				cred =>
					new Credential({
						...cred,
						loginType: this.mapLoginType(cred.loginType),
						isHashed: true,
					}),
			),
		});
	}
}

@Injectable()
export class IdentityPrismaRepositoryImpl implements IIdentityRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async findOneById(id: string, deleted = false): Promise<Identity | null> {
		const foundIdentity = await this.txHost.tx.identity.findUnique({
			where: { id: id, deletedAt: deleted ? { not: null } : null },
			include: identityPrismaIncludeObj,
		});
		return foundIdentity ? IdentityPrismaMapper.toIdentityAggregate(foundIdentity) : null;
	}

	async findOneCredential(
		identifier: string,
		loginType: LoginType,
	): Promise<{ identityId: string; secretHash: string | null } | null> {
		const foundCredential = await this.txHost.tx.credential.findUnique({
			where: { identifier_loginType: { identifier: identifier, loginType: loginType } },
			select: { identityId: true, secretHash: true },
		});
		return foundCredential;
	}

	async findOneByUsername(username: string, deleted = false): Promise<Identity | null> {
		const foundIdentity = await this.txHost.tx.identity.findUnique({
			where: { username: username, deletedAt: deleted ? { not: null } : null },
			include: identityPrismaIncludeObj,
		});
		return foundIdentity ? IdentityPrismaMapper.toIdentityAggregate(foundIdentity) : null;
	}

	async getClaimsOfId(
		id: string,
		deleted = false,
	): Promise<{ roles: Role[]; permissions: Permission[] } | null> {
		const foundIdentity = await this.txHost.tx.identity.findUnique({
			where: { id: id, deletedAt: deleted ? { not: null } : null },
			include: {
				identityRoles: {
					include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
				},
			},
		});
		if (!foundIdentity) return null;
		return {
			roles: foundIdentity.identityRoles.map(rIdentityRole =>
				IdentityPrismaMapper.mapRole(rIdentityRole.role.name),
			),
			permissions: [
				...new Set<Permission>(
					foundIdentity.identityRoles.flatMap(rIdentityRole =>
						rIdentityRole.role.rolePermissions.map(rPermission =>
							IdentityPrismaMapper.mapPermission(rPermission.permission.name),
						),
					),
				),
			],
		};
	}

	async save(identity: Identity): Promise<void> {
		const data = IdentityPrismaMapper.toIdentityOrm(identity);
		await this.txHost.withTransaction(async () => {
			// update or insert
			try {
				// insert if lock is new version
				if (data.version === 0)
					await this.txHost.tx.identity.create({ data: { ...data, version: 1 } });
				else
					await this.txHost.tx.identity.update({
						where: { id: data.id, version: data.version },
						data: { ...data, version: { increment: 1 } },
					});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2002') {
						const targetFields = ((e.meta?.target as string[]) || []).join(', ');
						throw new ConflictException(`Duplicate field(s): ${targetFields}`);
					}
				}
				throw e;
			}

			// handle events array
			for (const event of identity.getUncommittedEvents()) {
				await this.handle(event);
			}
		});
	}

	async softDelete(id: string): Promise<void> {
		await this.txHost.tx.identity.update({
			where: { id: id },
			data: { deletedAt: new Date() },
		});
	}

	private async handle(event: Event<any>): Promise<void> {
		if (event instanceof RoleAddedEvent) return this.onRoleAdded(event);
		if (event instanceof RoleDeletedEvent) return this.onRoleDeleted(event);
		if (event instanceof CredAddedEvent) return this.onCredAdded(event);
		if (event instanceof CredDeletedEvent) return this.onCredDeleted(event);
		if (event instanceof CredUpdatedEvent) return this.onCredUpdated(event);
	}

	private async onRoleAdded(event: RoleAddedEvent): Promise<void> {
		await this.txHost.tx.identityRole.create({
			data: { identityId: event.payload.identityId, roleId: event.payload.roleId },
		});
	}

	private async onRoleDeleted(event: RoleDeletedEvent): Promise<void> {
		await this.txHost.tx.identityRole.delete({
			where: {
				identityId_roleId: { identityId: event.payload.identityId, roleId: event.payload.roleId },
			},
		});
	}

	private async onCredAdded(event: CredAddedEvent): Promise<void> {
		try {
			await this.txHost.tx.credential.create({
				data: IdentityPrismaMapper.toCredentialOrm(event.payload.data, event.payload.identityId),
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					const targetFields = ((e.meta?.target as string[]) || []).join(', ');
					throw new ConflictException(`Duplicate field(s): ${targetFields}`);
				}
			}
			throw e;
		}
	}

	private async onCredDeleted(event: CredDeletedEvent): Promise<void> {
		await this.txHost.tx.credential.delete({
			where: { id: event.payload.credId },
		});
	}

	private async onCredUpdated(event: CredUpdatedEvent): Promise<void> {
		try {
			await this.txHost.tx.credential.update({
				where: { id: event.payload.credId },
				data: IdentityPrismaMapper.toCredentialOrm(event.payload.data, event.payload.identityId),
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					const targetFields = ((e.meta?.target as string[]) || []).join(', ');
					throw new ConflictException(`Duplicate field(s): ${targetFields}`);
				}
			}
			throw e;
		}
	}
}

// extended identity type with JOINS
type ExtendedIdentity = Prisma.IdentityGetPayload<{
	include: typeof identityPrismaIncludeObj;
}>;

type RepoIdentity = Omit<PrismaIdentity, 'updatedAt' | 'createdAt'>;

const identityPrismaIncludeObj = {
	identityRoles: {
		select: { roleId: true },
	},
	credentials: true,
} satisfies Prisma.IdentityInclude;
