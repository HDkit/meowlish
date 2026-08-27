import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { UpdateIdentityCommand } from '../auth.update-identity.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(UpdateIdentityCommand)
export class UpdateIdentityCommandHandler implements ICommandHandler<UpdateIdentityCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly eventBus: EventBus,
	) {}

	public async execute(command: UpdateIdentityCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		identity.updateDetails({
			username: payload.username,
			fullName: payload.fullName,
			bio: payload.bio,
			avatarFileId: payload.avatarId,
			phoneNumber: payload.phoneNumber,
		});
		await this.identityRepository.save(identity);
		this.eventBus.publishAll(identity.getUncommittedEvents());
	}
}
