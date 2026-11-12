import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { FileAddedPublisher } from '../../events/publisher/file-added.publisher';
import { UpdateIdentityCommand } from '../auth.update-identity.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(UpdateIdentityCommand)
export class UpdateIdentityCommandHandler implements ICommandHandler<UpdateIdentityCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly fileAddedPublisher: FileAddedPublisher,
	) {}

	@Transactional()
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
		await this.fileAddedPublisher.publish(identity.getUncommittedEvents());
	}
}
