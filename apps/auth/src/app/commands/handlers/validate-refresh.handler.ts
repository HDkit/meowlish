import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { TokenService } from '../../services/token.service';
import { ValidateRefreshCommand } from '../auth.validate-refresh.command';
import { ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Claims } from '@server/utils';

@CommandHandler(ValidateRefreshCommand)
export class ValidateRefreshCommandHandler implements ICommandHandler<ValidateRefreshCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: ValidateRefreshCommand): Promise<Claims> {
		const payload = command.payload;
		const isRevoked = await this.tokenService.isTokenRevoked(
			payload.identityId,
			payload.iat,
			payload.iatMs,
		);
		if (isRevoked) {
			throw new UnauthorizedException('Token has been revoked');
		}
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new UnauthorizedException();
		if (identity.isLocked) throw new ForbiddenException('Account locked');
		const claims = await this.identityRepository.getClaimsOfId(payload.identityId);
		if (!claims) throw new UnauthorizedException();
		return { ...claims, sub: payload.identityId };
	}
}
