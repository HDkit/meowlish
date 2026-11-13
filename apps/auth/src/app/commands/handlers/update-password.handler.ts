import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { TokenService } from '../../services/token.service';
import { UpdatePasswordCommand } from '../auth.update-password.command';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import bcrypt from 'bcrypt';

@CommandHandler(UpdatePasswordCommand)
export class UpdatePasswordCommandHandler implements ICommandHandler<UpdatePasswordCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: UpdatePasswordCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		// Refuse before checking the current password, so a demo request is always 403, never 401.
		identity.assertNotDemo('change its password');
		const credential = identity.credentials.find(cred => cred.id === payload.id);
		if (!credential) throw new NotFoundException('Credential not found');
		if (
			!credential.secretHash ||
			!(await bcrypt.compare(payload.currentPassword, credential.secretHash))
		)
			throw new UnauthorizedException('Wrong password');
		identity.updateCredential(payload.id, { secretHash: payload.password });
		await this.identityRepository.save(identity);
		// A changed password must end every existing session, or a stolen token outlives the change.
		await this.tokenService.revokeUser(payload.identityId);
	}
}
