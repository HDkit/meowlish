import { Credential } from '../../../domain/entities/credential.entity';
import { Identity } from '../../../domain/entities/identity.entity';
import { UserLoggedInEvent } from '../../../domain/events/user-activities.event';
import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import {
	type IRoleReadRepository,
	IRoleReadRepositoryToken,
} from '../../../domain/repositories/role.read.repository';
import { LoginType } from '../../../enums/login-type.enum';
import { Tokens } from '../../../types/tokens.type';
import { TokenService } from '../../services/token.service';
import { GoogleRegisterOrLoginCommand } from '../auth.google-register-or-login.command';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Role } from '@server/typing';

@CommandHandler(GoogleRegisterOrLoginCommand)
export class GoogleRegisterOrLoginCommandHandler
	implements ICommandHandler<GoogleRegisterOrLoginCommand>
{
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		@Inject(IRoleReadRepositoryToken)
		private readonly roleReadRepository: IRoleReadRepository,
		private readonly eventBus: EventBus,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: GoogleRegisterOrLoginCommand): Promise<Tokens> {
		const payload = command.payload;
		const credential = await this.identityRepository.findOneCredential(
			payload.identifier,
			LoginType.Google,
		);
		if (!credential) return this.register(payload.identifier, payload.username);
		return this.login(credential.identityId);
	}

	async login(identityId: string): Promise<Tokens> {
		const claims = await this.identityRepository.getClaimsOfId(identityId);
		if (!claims) throw new UnauthorizedException();
		this.eventBus.publish(new UserLoggedInEvent({ uid: identityId, date: new Date() }));
		return this.tokenService.generateTokens(
			{
				sub: identityId,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}

	async register(identifier: string, username: string): Promise<Tokens> {
		const identity = new Identity({ username: username });
		const credential = new Credential({
			identifier: identifier,
			loginType: LoginType.Google,
		});
		identity.addCredential(credential);
		const studentRole = await this.roleReadRepository.findByName(Role.Student);
		if (studentRole) {
			identity.addRole(studentRole.id);
		}
		await this.identityRepository.save(identity);
		const claims = await this.identityRepository.getClaimsOfId(identity.id);
		if (!claims) throw Error('Error when gettmg claims identity');
		return this.tokenService.generateTokens(
			{
				sub: identity.id,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}
}
