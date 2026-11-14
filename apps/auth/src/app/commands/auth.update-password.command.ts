import { Command } from '@server/utils';

export class UpdatePasswordCommand extends Command<{
	identityId: string;
	id: string;
	currentPassword: string;
	password: string;
}> {}
