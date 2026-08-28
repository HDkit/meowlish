import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { LockIdentityCommand } from '../auth.lock-identity.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(LockIdentityCommand)
export class LockIdentityCommandHandler implements ICommandHandler<LockIdentityCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly eventBus: EventBus,
	) {}

	public async execute(command: LockIdentityCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		identity.lock(payload.lockedBy);
		await this.identityRepository.save(identity);
		this.eventBus.publishAll(identity.getUncommittedEvents());
	}
}
