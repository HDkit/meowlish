import { Credential } from '../../../domain/entities/credential.entity';
import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { LoginType } from '../../../enums/login-type.enum';
import { TokenService } from '../../services/token.service';
import { AddMailCredCommand } from '../auth.add-mail-cred.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(AddMailCredCommand)
export class AddMailCredCommandHandler implements ICommandHandler<AddMailCredCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly eventBus: EventBus,
		private readonly tokenService: TokenService,
	) {}

	public async execute(command: AddMailCredCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		identity.addCredential(
			new Credential({
				identifier: payload.mail,
				loginType: LoginType.Mail,
				secretHash: await Credential.hashSecret(payload.password),
			}),
		);
		await this.identityRepository.save(identity);
	}
}
