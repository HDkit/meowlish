import { Command } from '@server/utils';

export class UnlockIdentityCommand extends Command<{ identityId: string }> {}
