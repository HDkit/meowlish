import {
	type IGoogleCalendarTokenRepository,
	IGoogleCalendarTokenRepositoryToken,
} from '../../../domain/repositories/google-calendar-token.repository';
import { ConnectGoogleCalendarCommand } from '../auth.connect-google-calendar.command';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ConnectGoogleCalendarCommand)
export class ConnectGoogleCalendarCommandHandler
	implements ICommandHandler<ConnectGoogleCalendarCommand>
{
	constructor(
		@Inject(IGoogleCalendarTokenRepositoryToken)
		private readonly tokenRepository: IGoogleCalendarTokenRepository,
	) {}

	public async execute(command: ConnectGoogleCalendarCommand): Promise<void> {
		const payload = command.payload;
		const expiresAt = new Date(payload.expiresAt);

		await this.tokenRepository.upsert({
			identityId: payload.identityId,
			accessToken: payload.accessToken,
			refreshToken: payload.refreshToken,
			expiresAt: expiresAt,
			scopes: payload.scopes,
		});
	}
}
