import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { UnlockIdentityCommand } from '../auth.unlock-identity.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(UnlockIdentityCommand)
export class UnlockIdentityCommandHandler implements ICommandHandler<UnlockIdentityCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly eventBus: EventBus,
	) {}

	public async execute(command: UnlockIdentityCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		identity.unlock();
		await this.identityRepository.save(identity);
		this.eventBus.publishAll(identity.getUncommittedEvents());
	}
}
