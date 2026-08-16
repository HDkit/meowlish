import { type Credential } from '../entities/credential.entity';
import { Identity } from '../entities/identity.entity';
import { Event } from '@server/utils';

// events
export class IdentityUpdatedEvent extends Event<{
	identityId: string;
	data: Identity;
}> {}
export class IdentityAvatarUpdatedEvent extends Event<{
	identityId: string;
	avatarFileId: string | null;
}> {}
export class RoleAddedEvent extends Event<{ identityId: string; roleId: string }> {}
export class RoleDeletedEvent extends Event<{ identityId: string; roleId: string }> {}
export class CredAddedEvent extends Event<{ identityId: string; data: Credential }> {}
export class CredDeletedEvent extends Event<{ identityId: string; credId: string }> {}
export class CredUpdatedEvent extends Event<{
	identityId: string;
	credId: string;
	data: Credential;
}> {}
