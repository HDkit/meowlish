import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { TokenService } from '../../services/token.service';
import { ValidateAccessCommand } from '../auth.validate-access.command';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ValidateAccessCommand)
export class ValidateAccessCommandHandler implements ICommandHandler<ValidateAccessCommand> {
	constructor(
		private readonly tokenService: TokenService,
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
	) {}

	public async execute(command: ValidateAccessCommand): Promise<void> {
		const payload = command.payload;
		const isRevoked = await this.tokenService.isTokenRevoked(payload.identityId, payload.iat);
		if (isRevoked) {
			throw new UnauthorizedException('Token has been revoked');
		}
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) {
			throw new UnauthorizedException('Identity not found');
		}
		if (identity.isLocked) {
			throw new UnauthorizedException('Account is locked');
		}
	}
}
