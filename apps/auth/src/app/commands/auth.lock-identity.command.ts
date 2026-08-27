import { Command } from '@server/utils';

export class LockIdentityCommand extends Command<{ identityId: string; lockedBy: string }> {}
