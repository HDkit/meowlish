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
import { ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import bcrypt from 'bcrypt';

// Compared against when the mail is unknown so both failure paths cost one bcrypt compare.
const DUMMY_HASH = '$2b$10$kfnr7gPQwuYHNrHZTDaI.uVoM9U2cCp/fecWJ.44XFHGCOkp72g/i';
const INVALID_LOGIN = 'Invalid email or password';

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
		const matches = await bcrypt.compare(payload.password, credential?.secretHash ?? DUMMY_HASH);
		if (!credential || !credential.secretHash || !matches)
			throw new UnauthorizedException(INVALID_LOGIN);
		// Reject before any outbox write.
		const identity = await this.identityRepository.findOneById(credential.identityId);
		if (!identity) throw new UnauthorizedException(INVALID_LOGIN);
		if (identity.isLocked) throw new ForbiddenException('Account locked');
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
