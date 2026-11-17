import { Tokens } from '../../types/tokens.type';
import { Command } from '@server/utils';

export class GoogleRegisterOrLoginCommandPayload {
	constructor(
		public readonly identifier: string,
		/** Fallback username when none can be derived from `email`. */
		public readonly username: string,
		/** Google profile display name. */
		public readonly fullName?: string,
		/** Google account email. */
		public readonly email?: string,
	) {}
}

export class GoogleRegisterOrLoginCommand extends Command<
	GoogleRegisterOrLoginCommandPayload,
	Tokens
> {}
