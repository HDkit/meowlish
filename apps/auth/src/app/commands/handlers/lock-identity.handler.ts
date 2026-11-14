import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import { IdentityLockedPublisher } from '../../events/publisher/identity-locked.publisher';
import { LockIdentityCommand } from '../auth.lock-identity.command';
import { Transactional } from '@nestjs-cls/transactional';
import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Role } from '@server/typing';

/** Higher outranks lower; you can only lock people strictly below you. */
const rankOf = (roles: readonly Role[]): number =>
	roles.includes(Role.Admin) ? 2
	: roles.includes(Role.Mod) ? 1
	: 0;

@CommandHandler(LockIdentityCommand)
export class LockIdentityCommandHandler implements ICommandHandler<LockIdentityCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		private readonly identityLockedPublisher: IdentityLockedPublisher,
	) {}

	@Transactional()
	public async execute(command: LockIdentityCommand): Promise<void> {
		const payload = command.payload;
		const identity = await this.identityRepository.findOneById(payload.identityId);
		if (!identity) throw new NotFoundException('Identity not found');
		if (payload.identityId === payload.lockedBy) {
			throw new ForbiddenException('You cannot lock your own account');
		}
		const [lockerClaims, targetClaims] = await Promise.all([
			this.identityRepository.getClaimsOfId(payload.lockedBy),
			this.identityRepository.getClaimsOfId(payload.identityId),
		]);
		if (rankOf(targetClaims?.roles ?? []) >= rankOf(lockerClaims?.roles ?? [])) {
			throw new ForbiddenException('You can only lock accounts with a lower role than yours');
		}
		identity.lock(payload.lockedBy);
		await this.identityRepository.save(identity);
		await this.identityLockedPublisher.publish(identity.getUncommittedEvents());
	}
}
