import { Credential } from '../../../domain/entities/credential.entity';
import { Identity } from '../../../domain/entities/identity.entity';
import { UserLoggedInEvent } from '../../../domain/events/user-activities.event';
import {
	type IIdentityRepository,
	IIdentityRepositoryToken,
} from '../../../domain/repositories/identity.repository';
import {
	type IRoleReadRepository,
	IRoleReadRepositoryToken,
} from '../../../domain/repositories/role.read.repository';
import { LoginType } from '../../../enums/login-type.enum';
import { Tokens } from '../../../types/tokens.type';
import { UserLoggedInPublisher } from '../../events/publisher/logged-in.publisher';
import { TokenService } from '../../services/token.service';
import {
	GoogleRegisterOrLoginCommand,
	GoogleRegisterOrLoginCommandPayload,
} from '../auth.google-register-or-login.command';
import { Transactional } from '@nestjs-cls/transactional';
import { ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Role } from '@server/typing';
import { randomBytes } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_MAX = 30;
const USERNAME_ATTEMPTS = 5;

/** Usernames that Google sign-up generated before they were derived from the email. */
export const isGeneratedUsername = (username: string): boolean => UUID_PATTERN.test(username);

/** The email's local part, lowercased and limited to [a-z0-9._-]; '' when nothing usable is left. */
export const usernameBaseFromEmail = (email: string | undefined): string =>
	(email?.split('@')[0] ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9._-]/g, '')
		.replace(/^[._-]+|[._-]+$/g, '')
		.slice(0, USERNAME_MAX);

@CommandHandler(GoogleRegisterOrLoginCommand)
export class GoogleRegisterOrLoginCommandHandler implements ICommandHandler<GoogleRegisterOrLoginCommand> {
	constructor(
		@Inject(IIdentityRepositoryToken) private readonly identityRepository: IIdentityRepository,
		@Inject(IRoleReadRepositoryToken)
		private readonly roleReadRepository: IRoleReadRepository,
		private readonly loggedInPublisher: UserLoggedInPublisher,
		private readonly tokenService: TokenService,
	) {}

	@Transactional()
	public async execute(command: GoogleRegisterOrLoginCommand): Promise<Tokens> {
		const payload = command.payload;
		const credential = await this.identityRepository.findOneCredential(
			payload.identifier,
			LoginType.Google,
		);
		if (!credential) return this.register(payload);
		return this.login(credential.identityId, payload);
	}

	async login(identityId: string, profile: GoogleRegisterOrLoginCommandPayload): Promise<Tokens> {
		// Reject before any outbox write.
		const identity = await this.identityRepository.findOneById(identityId);
		if (!identity) throw new UnauthorizedException();
		if (identity.isLocked) throw new ForbiddenException('Account locked');
		await this.fillMissingProfile(identity, profile);
		const claims = await this.identityRepository.getClaimsOfId(identityId);
		if (!claims) throw new UnauthorizedException();
		await this.loggedInPublisher.publish(
			new UserLoggedInEvent({ uid: identityId, date: new Date() }),
		);
		return this.tokenService.generateTokens(
			{
				sub: identityId,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}

	async register(profile: GoogleRegisterOrLoginCommandPayload): Promise<Tokens> {
		const identity = new Identity({
			username: await this.pickUsername(profile.email, profile.username),
			fullName: profile.fullName?.trim() || null,
		});
		const credential = new Credential({
			identifier: profile.identifier,
			loginType: LoginType.Google,
		});
		identity.addCredential(credential);
		const studentRole = await this.roleReadRepository.findByName(Role.Student);
		if (studentRole) {
			identity.addRole(studentRole.id);
		}
		await this.identityRepository.save(identity);
		const claims = await this.identityRepository.getClaimsOfId(identity.id);
		if (!claims) throw Error('Error when gettmg claims identity');
		return this.tokenService.generateTokens(
			{
				sub: identity.id,
				permissions: claims.permissions,
				roles: claims.roles,
			},
			true,
		);
	}

	/**
	 * Accounts created by Google sign-up before names were copied from the profile have no full
	 * name and a UUID username, which the frontend showed as the user's name. Fill them in once.
	 */
	private async fillMissingProfile(
		identity: Identity,
		profile: GoogleRegisterOrLoginCommandPayload,
	): Promise<void> {
		const fullName = profile.fullName?.trim();
		const update: { fullName?: string; username?: string } = {};
		if (!identity.fullName && fullName) update.fullName = fullName;
		if (isGeneratedUsername(identity.username) && usernameBaseFromEmail(profile.email)) {
			const username = await this.pickUsername(profile.email, identity.username);
			if (username !== identity.username) update.username = username;
		}
		if (!update.fullName && !update.username) return;
		identity.updateDetails(update);
		await this.identityRepository.save(identity);
	}

	/** The email's local part, with a random suffix if taken; `fallback` if none is free. */
	private async pickUsername(email: string | undefined, fallback: string): Promise<string> {
		const base = usernameBaseFromEmail(email);
		if (!base) return fallback;
		for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
			const candidate =
				attempt === 0 ? base : (
					`${base.slice(0, USERNAME_MAX - 5)}-${randomBytes(2).toString('hex')}`
				);
			if (!(await this.isUsernameTaken(candidate))) return candidate;
		}
		return fallback;
	}

	/** usernames are unique across active and soft-deleted identities */
	private async isUsernameTaken(username: string): Promise<boolean> {
		return (
			(await this.identityRepository.findOneByUsername(username)) !== null ||
			(await this.identityRepository.findOneByUsername(username, true)) !== null
		);
	}
}
