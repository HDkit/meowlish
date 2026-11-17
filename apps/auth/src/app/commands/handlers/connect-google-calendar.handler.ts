import {
	type IGoogleCalendarTokenRepository,
	IGoogleCalendarTokenRepositoryToken,
} from '../../../domain/repositories/google-calendar-token.repository';
import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { ConnectGoogleCalendarCommand } from '../auth.connect-google-calendar.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ConnectGoogleCalendarCommand)
export class ConnectGoogleCalendarCommandHandler implements ICommandHandler<ConnectGoogleCalendarCommand> {
	constructor(
		@Inject(IGoogleCalendarTokenRepositoryToken)
		private readonly tokenRepository: IGoogleCalendarTokenRepository,
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
	) {}

	public async execute(command: ConnectGoogleCalendarCommand): Promise<{ expiresAt: number }> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		// Tokens stored on the shared demo account would be readable by every other tester.
		identity.assertNotDemo('connect Google Calendar');
		const expiresAt = new Date(payload.expiresAt);

		// Google omits the refresh token on re-consent; keep the stored one then.
		const refreshToken =
			payload.refreshToken ||
			(await this.tokenRepository.findByIdentityId(payload.identityId))?.refreshToken ||
			'';

		await this.tokenRepository.upsert({
			identityId: payload.identityId,
			accessToken: payload.accessToken,
			refreshToken: refreshToken,
			expiresAt: expiresAt,
			scopes: payload.scopes,
		});
		return { expiresAt: expiresAt.getTime() };
	}
}
