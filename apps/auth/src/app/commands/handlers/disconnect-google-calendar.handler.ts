import {
	type IGoogleCalendarTokenRepository,
	IGoogleCalendarTokenRepositoryToken,
} from '../../../domain/repositories/google-calendar-token.repository';
import { DisconnectGoogleCalendarCommand } from '../auth.disconnect-google-calendar.command';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(DisconnectGoogleCalendarCommand)
export class DisconnectGoogleCalendarCommandHandler
	implements ICommandHandler<DisconnectGoogleCalendarCommand>
{
	constructor(
		@Inject(IGoogleCalendarTokenRepositoryToken)
		private readonly tokenRepository: IGoogleCalendarTokenRepository,
	) {}

	public async execute(command: DisconnectGoogleCalendarCommand): Promise<void> {
		await this.tokenRepository.delete(command.payload.identityId);
	}
}
