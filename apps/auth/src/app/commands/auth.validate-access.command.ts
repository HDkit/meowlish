import { Command } from '@server/utils';

export class ValidateAccessCommandPayload {
	constructor(
		public readonly identityId: string,
		public readonly iat: number,
		public readonly iatMs?: number,
	) {}
}

export class ValidateAccessCommand extends Command<ValidateAccessCommandPayload> {}
