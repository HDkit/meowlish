import {
	CredAddedEvent,
	CredDeletedEvent,
	CredUpdatedEvent,
	IdentityAvatarUpdatedEvent,
	IdentityLockedEvent,
	IdentityUnlockedEvent,
	IdentityUpdatedEvent,
	RoleAddedEvent,
	RoleDeletedEvent,
} from '../events/identity-update.events';
import { Credential, type CredentialUpdatableProperties } from './credential.entity';
import {
	ConflictException,
	ForbiddenException,
	MethodNotAllowedException,
	NotFoundException,
} from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate } from '@server/utils';

export class Identity extends AggregateRoot<Event<any>> implements IAggregate<Identity> {
	public static newId(): string {
		return crypto.randomUUID();
	}

	public readonly id: string;
	public readonly version: number;
	public username: string;
	public fullName: string | null;
	public bio: string | null;
	public avatarFileId: string | null;
	public phoneNumber: string | null;
	public isLocked: boolean;
	public lockedAt: Date | null;
	public lockedBy: string | null;
	/** Shared demo account: credentials, username and phone are read-only. */
	public readonly isDemo: boolean;
	public roleIds: Set<string>;
	public credentials: Credential[];
	public readonly createdAt: Date;
	public readonly updatedAt: Date;
	public deletedAt: Date | null;

	public constructor(constructorOptions: {
		id?: string;
		version?: number;
		username: string;
		fullName?: string | null;
		bio?: string | null;
		avatarFileId?: string | null;
		phoneNumber?: string | null;
		isLocked?: boolean;
		lockedAt?: Date | null;
		lockedBy?: string | null;
		isDemo?: boolean;
		createdAt?: Date;
		updatedAt?: Date;
		deletedAt?: Date | null;
		roleIds?: string[];
		credentials?: Credential[];
	}) {
		super();
		this.id = constructorOptions.id ?? Identity.newId();
		this.version = constructorOptions.version ?? 0;
		this.username = constructorOptions.username;
		this.fullName = constructorOptions.fullName ?? null;
		this.bio = constructorOptions.bio ?? null;
		this.avatarFileId = constructorOptions.avatarFileId ?? null;
		this.phoneNumber = constructorOptions.phoneNumber ?? null;
		this.isLocked = constructorOptions.isLocked ?? false;
		this.lockedAt = constructorOptions.lockedAt ?? null;
		this.lockedBy = constructorOptions.lockedBy ?? null;
		this.isDemo = constructorOptions.isDemo ?? false;
		this.createdAt = constructorOptions.createdAt ?? new Date();
		this.updatedAt = constructorOptions.updatedAt ?? new Date();
		this.deletedAt = constructorOptions.deletedAt ?? null;
		this.roleIds = new Set(constructorOptions.roleIds);
		this.credentials = constructorOptions.credentials ?? [];
	}

	/** Rejects actions that would let one tester lock others out of the shared demo account. */
	public assertNotDemo(action: string): void {
		if (this.isDemo) throw new ForbiddenException(`The demo account can't ${action}`);
	}

	public updateDetails(options: IdentityUpdatableProperties): void {
		if (options.username && options.username !== this.username)
			this.assertNotDemo('change its username');
		if (
			(options.phoneNumber || options.phoneNumber === null) &&
			options.phoneNumber !== this.phoneNumber
		)
			this.assertNotDemo('change its phone number');
		if (options.username) this.username = options.username;
		if (options.fullName || options.fullName === null) this.fullName = options.fullName;
		if (options.bio || options.bio === null) this.bio = options.bio;
		if (options.phoneNumber || options.phoneNumber === null) this.phoneNumber = options.phoneNumber;
		if (
			(options.avatarFileId || options.avatarFileId === null) &&
			options.avatarFileId !== this.avatarFileId
		) {
			this.avatarFileId = options.avatarFileId;
			this.apply(
				new IdentityAvatarUpdatedEvent({ identityId: this.id, avatarFileId: this.avatarFileId }),
			);
		}
		this.apply(new IdentityUpdatedEvent({ identityId: this.id, data: structuredClone(this) }));
	}

	public lock(adminId: string): void {
		if (this.isLocked) throw new ConflictException('Identity is already locked');
		this.isLocked = true;
		this.lockedAt = new Date();
		this.lockedBy = adminId;
		this.apply(new IdentityLockedEvent({ identityId: this.id, lockedBy: adminId }));
	}

	public unlock(): void {
		if (!this.isLocked) throw new ConflictException('Identity is not locked');
		this.isLocked = false;
		this.lockedAt = null;
		this.lockedBy = null;
		this.apply(new IdentityUnlockedEvent({ identityId: this.id }));
	}

	public addRole(roleId: string): void {
		if (this.roleIds.has(roleId)) throw new ConflictException('Role already exists');
		this.roleIds.add(roleId);
		this.apply(new RoleAddedEvent({ identityId: this.id, roleId: roleId }));
	}

	public removeRole(roleId: string): void {
		if (!this.roleIds.has(roleId)) throw new ConflictException('Role does not exist');
		this.roleIds.delete(roleId);
		this.apply(new RoleDeletedEvent({ identityId: this.id, roleId: roleId }));
	}

	public addCredential(cred: Credential): void {
		this.assertNotDemo('add sign-in methods');
		for (const x of this.credentials) {
			if (x.id === cred.id) throw new ConflictException("Credential's id must be unique");
			if (x.identifier === cred.identifier && x.loginType === cred.loginType)
				throw new ConflictException(
					'Identity cannot have the same identifier for the same type of credential',
				);
			// one sign-in method per type (also a unique index on identity_id + login_type)
			if (x.loginType === cred.loginType)
				throw new ConflictException(`Identity already has a ${cred.loginType} credential`);
		}
		this.credentials.push(cred);
		this.apply(new CredAddedEvent({ identityId: this.id, data: structuredClone(cred) }));
	}

	public deleteCredential(id: string): void {
		this.assertNotDemo('remove sign-in methods');
		const idx = this.credentials.findIndex(cred => cred.id === id);
		if (idx === -1) throw new NotFoundException('Credential not found');
		if (this.credentials.length === 1)
			throw new MethodNotAllowedException('Cannot remove your last credential');
		this.credentials.splice(idx, 1);
		this.apply(new CredDeletedEvent({ identityId: this.id, credId: id }));
	}

	public updateCredential(credId: string, updateOptions: CredentialUpdatableProperties): void {
		this.assertNotDemo('change its sign-in methods or password');
		const credential = this.credentials.find(cred => cred.id === credId);
		if (!credential) throw new NotFoundException('Credential not found');
		credential.update(updateOptions);
		const duplicateCredIdx = this.credentials.findIndex(
			cred =>
				cred.id !== credential.id &&
				cred.identifier === credential.identifier &&
				cred.loginType === credential.loginType,
		);
		if (duplicateCredIdx !== -1)
			throw new ConflictException(
				'Identity cannot have the same identifier for the same type of credential',
			);
		this.apply(
			new CredUpdatedEvent({
				identityId: this.id,
				credId: credId,
				data: structuredClone(credential),
			}),
		);
	}

	public softDelete(): void {
		if (this.deletedAt !== null) throw new NotFoundException('Identity was already deleted');
		this.deletedAt = new Date();
	}
}

type IdentityUpdatableProperties = Partial<
	Pick<Identity, 'username' | 'fullName' | 'bio' | 'avatarFileId' | 'phoneNumber'>
>;
