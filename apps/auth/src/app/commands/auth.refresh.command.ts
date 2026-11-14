import { Tokens } from '../../types/tokens.type';
import { Command } from '@server/utils';

export class RefreshCommandPayload {
	constructor(
		public readonly identityId: string,
		/**
		 * jti of the refresh token being exchanged. Absent: a new session (new family) for an
		 * identity the caller already verified, e.g. the gateway right after a password change.
		 */
		public readonly jti?: string,
		/** Its `fam` claim; absent on tokens issued before rotation. */
		public readonly family?: string,
	) {}
}

export class RefreshCommand extends Command<RefreshCommandPayload, Tokens> {}
