import { UserLoggedInEvent } from '../../../domain/events/user-activities.event';
import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { LoginType } from '../../../enums/login-type.enum';
import { Tokens } from '../../../types/tokens.type';
import { UserLoggedInPublisher } from '../../events/publisher/logged-in.publisher';
import { TokenService } from '../../services/token.service';
import { MailLoginCommand } from '../auth.mail-login.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import bcrypt from 'bcrypt';

@CommandHandler(MailLoginCommand)
export class MailLoginCommandHandler implements ICommandHandler<MailLoginCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly loggedInPublisher: UserLoggedInPublisher,
		private readonly tokenService: TokenService,
	) {}

	@Transactional()
	public async execute(command: MailLoginCommand): Promise<Tokens> {
		const payload = command.payload;
		const credential = await this.identityRepository.findOneCredential(
			payload.mail,
			LoginType.Mail,
		);
		if (!credential) throw new UnauthorizedException("Mail doesn't exist");
		if (!credential.secretHash || !bcrypt.compareSync(payload.password, credential.secretHash))
			throw new UnauthorizedException('Wrong password');
		const claims = await this.identityRepository.getClaimsOfId(credential.identityId);
		if (!claims) throw new UnauthorizedException();
		await this.loggedInPublisher.publish(
			new UserLoggedInEvent({ uid: credential.identityId, date: new Date() }),
		);
		return this.tokenService.generateTokens(
			{
				sub: credential.identityId,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}
}
