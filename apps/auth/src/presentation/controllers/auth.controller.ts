import { AddGoogleCredCommand } from '../../app/commands/auth.add-google-cred.command';
import { AddMailCredCommand } from '../../app/commands/auth.add-mail-cred.command';
import { AssignRoleToCommand } from '../../app/commands/auth.assign-role-to.command';
import { GoogleRegisterOrLoginCommand } from '../../app/commands/auth.google-register-or-login.command';
import {
	LogoutAllCommand,
	LogoutAllCommandPayload,
} from '../../app/commands/auth.logout-all.command';
import {
	MailLoginCommand,
	MailLoginCommandPayload,
} from '../../app/commands/auth.mail-login.command';
import {
	MailRegisterCommand,
	MailRegisterCommandPayload,
} from '../../app/commands/auth.mail-register.command';
import { RefreshCommand, RefreshCommandPayload } from '../../app/commands/auth.refresh.command';
import { RemoveCredCommand } from '../../app/commands/auth.remove-cred.command';
import { RemoveRoleFromCommand } from '../../app/commands/auth.remove-role-from.command';
import {
	UpdateIdentityCommand,
	UpdateIdentityCommandPayload,
} from '../../app/commands/auth.update-identity.command';
import { UpdatePasswordCommand } from '../../app/commands/auth.update-password.command';
import {
	ValidateAccessCommand,
	ValidateAccessCommandPayload,
} from '../../app/commands/auth.validate-access.command';
import {
	ValidateRefreshCommand,
	ValidateRefreshCommandPayload,
} from '../../app/commands/auth.validate-refresh.command';
import { FindIdentitiesQuery } from '../../app/queries/auth.find-identities.query';
import { FindIdentityIdsQuery } from '../../app/queries/auth.find-identity-ids.query';
import { GetCredentialsQuery } from '../../app/queries/auth.get-credentials.query';
import { GetPermissionsQuery } from '../../app/queries/auth.get-permissions.query';
import { GetRolesQuery } from '../../app/queries/auth.get-roles.query';
import { HydrateManyQuery } from '../../app/queries/auth.hydrate-many.query';
import { HydrateQuery } from '../../app/queries/auth.hydrate.query';
import { AddGoogleCredDto } from '../dtos/req/add-google-cred.req.dto';
import { AddMailCredDto } from '../dtos/req/add-mail-cred.req.dto';
import { AssignRoleToDto } from '../dtos/req/assign-role-to.req.dto';
import { FindIdentitiesDto } from '../dtos/req/find-identities.req.dto';
import { FindIdentityIdsDto } from '../dtos/req/find-identity-ids.req.dto';
import { GetCredsDto } from '../dtos/req/get-creds.req.dto';
import { HydrateManyDto } from '../dtos/req/hydrate-many.req.dto';
import { HydrateDto } from '../dtos/req/hydrate.req.dto';
import { LoginMailDto } from '../dtos/req/login-mail.req.dto';
import { LogOutAllDto } from '../dtos/req/logout-all.req.dto';
import { RefreshDto } from '../dtos/req/refresh-dto.req.dto';
import { RegisterMailDto } from '../dtos/req/register-mail.req.dto';
import { RegisterOrLoginGoogleDto } from '../dtos/req/register-or-login-google.req.dto';
import { RemoveCredDto } from '../dtos/req/remove-cred.req.dto';
import { RemoveRoleFromDto } from '../dtos/req/remove-role-from.req.dto';
import { UpdateIdentityDto } from '../dtos/req/update-identity.req.dto';
import { UpdateMailPasswordDto } from '../dtos/req/update-password.req.dto';
import { ValidateAccessDto } from '../dtos/req/validate-access.req.dto';
import { ValidateRefreshDto } from '../dtos/req/validate-refresh.req.dto';
import { ClaimsDto } from '../dtos/res/claims.res.dto';
import { CredentialsDto } from '../dtos/res/credentials.res.dto';
import { HydratedIdentitiesDto, HydratedIdentityDto } from '../dtos/res/hydrated-identities.dto';
import { IdentitiesDto } from '../dtos/res/identities.res.dto';
import { IdentityIdsDto } from '../dtos/res/identity-ids.res.dto';
import { PermissionsDto } from '../dtos/res/permissions.res.dto';
import { RolesDto } from '../dtos/res/roles.res.dto';
import { TokensDto } from '../dtos/res/tokens.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Payload } from '@nestjs/microservices';
import { auth } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@auth.AuthServiceControllerMethods()
@Controller()
export class AuthController implements auth.AuthServiceController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SerializeOptions({ type: TokensDto })
	async loginMail(@Payload() request: LoginMailDto): Promise<TokensDto> {
		const res = await this.commandBus.execute(
			new MailLoginCommand(new MailLoginCommandPayload(request.mail, request.password)),
		);
		return res;
	}

	@SerializeOptions({ type: TokensDto })
	async registerMail(@Payload() request: RegisterMailDto): Promise<TokensDto> {
		const res = await this.commandBus.execute(
			new MailRegisterCommand(
				new MailRegisterCommandPayload(request.mail, request.username, request.password),
			),
		);
		return res;
	}

	@SerializeOptions({ type: TokensDto })
	async refresh(@Payload() request: RefreshDto): Promise<TokensDto> {
		const res = await this.commandBus.execute(
			new RefreshCommand(new RefreshCommandPayload(request.identityId)),
		);
		return res;
	}

	@SerializeOptions({ type: ClaimsDto })
	async validateRefresh(@Payload() request: ValidateRefreshDto): Promise<ClaimsDto> {
		const res = await this.commandBus.execute(
			new ValidateRefreshCommand(
				new ValidateRefreshCommandPayload(request.identityId, request.iat),
			),
		);
		return res;
	}

	async validateAccess(@Payload() request: ValidateAccessDto): Promise<void> {
		await this.commandBus.execute(
			new ValidateAccessCommand(new ValidateAccessCommandPayload(request.identityId, request.iat)),
		);
	}

	async logOutAll(@Payload() request: LogOutAllDto): Promise<void> {
		await this.commandBus.execute(
			new LogoutAllCommand(new LogoutAllCommandPayload(request.identityId)),
		);
	}

	@SerializeOptions({ type: TokensDto })
	async registerOrLoginGoogle(@Payload() request: RegisterOrLoginGoogleDto): Promise<TokensDto> {
		return await this.commandBus.execute(new GoogleRegisterOrLoginCommand(request));
	}

	async addMailCredential(@Payload() request: AddMailCredDto): Promise<void> {
		await this.commandBus.execute(new AddMailCredCommand(request));
	}

	async addGoogleCredential(@Payload() request: AddGoogleCredDto): Promise<void> {
		await this.commandBus.execute(new AddGoogleCredCommand(request));
	}

	async removeCredential(@Payload() request: RemoveCredDto): Promise<void> {
		await this.commandBus.execute(
			new RemoveCredCommand({ identityId: request.identityId, id: request.id }),
		);
	}

	@SerializeOptions({ type: CredentialsDto })
	async getCredentials(@Payload() request: GetCredsDto): Promise<CredentialsDto> {
		return { credentials: await this.queryBus.execute(new GetCredentialsQuery(request)) };
	}

	async assignRoleTo(@Payload() request: AssignRoleToDto): Promise<void> {
		await this.commandBus.execute(new AssignRoleToCommand(request));
	}

	async removeRoleFrom(@Payload() request: RemoveRoleFromDto): Promise<void> {
		await this.commandBus.execute(new RemoveRoleFromCommand(request));
	}

	@SerializeOptions({ type: IdentitiesDto })
	async findIdentities(@Payload() request: FindIdentitiesDto): Promise<IdentitiesDto> {
		return await this.queryBus.execute(new FindIdentitiesQuery(request));
	}

	@SerializeOptions({ type: IdentityIdsDto })
	async findIdentityIds(@Payload() request: FindIdentityIdsDto): Promise<IdentityIdsDto> {
		return await this.queryBus.execute(new FindIdentityIdsQuery(request));
	}

	@SerializeOptions({ type: RolesDto })
	async getRoleList(): Promise<RolesDto> {
		return { roles: await this.queryBus.execute(new GetRolesQuery()) };
	}

	@SerializeOptions({ type: PermissionsDto })
	async getPermList(): Promise<PermissionsDto> {
		return { perms: await this.queryBus.execute(new GetPermissionsQuery()) };
	}

	async updateIdentity(@Payload() request: UpdateIdentityDto): Promise<void> {
		await this.commandBus.execute(
			new UpdateIdentityCommand(new UpdateIdentityCommandPayload(request)),
		);
	}

	async updateMailPassword(@Payload() request: UpdateMailPasswordDto): Promise<void> {
		await this.commandBus.execute(new UpdatePasswordCommand(request));
	}

	@SerializeOptions({ type: HydratedIdentitiesDto })
	async hydrateIdentities(@Payload() request: HydrateManyDto): Promise<HydratedIdentitiesDto> {
		return {
			identities: await this.queryBus.execute(new HydrateManyQuery({ ids: request.identityIds })),
		};
	}

	@SerializeOptions({ type: HydratedIdentityDto })
	async hydrateIdentity(@Payload() request: HydrateDto): Promise<HydratedIdentityDto> {
		return await this.queryBus.execute(new HydrateQuery({ id: request.identityId }));
	}
}
