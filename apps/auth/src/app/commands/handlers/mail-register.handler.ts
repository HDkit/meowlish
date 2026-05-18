import { Credential } from '../../../domain/entities/credential.entity';
import { Identity } from '../../../domain/entities/identity.entity';
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
import { MailRegisterCommand } from '../auth.mail-register.command';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Role } from '@server/typing';

@CommandHandler(MailRegisterCommand)
export class MailRegisterCommandHandler implements ICommandHandler<MailRegisterCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		@Inject(IRoleReadRepositoryToken)
		private readonly roleReadRepository: IRoleReadRepository,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: MailRegisterCommand): Promise<Tokens> {
		const payload = command.payload;
		const identity = new Identity({ username: payload.username });
		const credential = new Credential({
			identifier: payload.mail,
			loginType: LoginType.Mail,
			secretHash: payload.password,
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
