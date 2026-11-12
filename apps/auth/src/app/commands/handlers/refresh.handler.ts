import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { Tokens } from '../../../types/tokens.type';
import { TokenService } from '../../services/token.service';
import { RefreshCommand } from '../auth.refresh.command';
import { ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(RefreshCommand)
export class RefreshCommandHandler implements ICommandHandler<RefreshCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: RefreshCommand): Promise<Tokens> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new UnauthorizedException();
		if (identity.isLocked) throw new ForbiddenException('Account locked');
		const claims = await this.identityRepository.getClaimsOfId(payload.identityId);
		if (!claims) throw new UnauthorizedException();
		return this.tokenService.generateTokens(
			{
				sub: payload.identityId,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}
}
