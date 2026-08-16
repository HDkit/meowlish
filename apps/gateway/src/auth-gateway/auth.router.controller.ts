import { IsPublic } from '../auth/decorators/public.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { GoogleOAuth2Guard } from '../auth/guards/google-oauth2.guard';
import { JwtRefreshAuthGuard } from '../auth/guards/jwt-refresh-auth.guard';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { AUTH_CLIENT } from './constants/auth';
import { AddMailCredDto } from './dtos/req/add-mail-cred.req.dto';
import { AssignRoleToDto } from './dtos/req/assign-role-to.req.dto';
import { FindIdentitiesLimitedDto } from './dtos/req/find-identities-limited.req.dto';
import { FindIdentitiesDto } from './dtos/req/find-identities.req.dto';
import { FindIdentityIdsDto } from './dtos/req/find-identity-ids.req.dto';
import { LoginMailDto } from './dtos/req/login-mail.req.dto';
import { RegisterMailDto } from './dtos/req/register-mail.req.dto';
import { RemoveRoleFromDto } from './dtos/req/remove-role-from.req.dto';
import { UpdateIdentityDto } from './dtos/req/update-identity.req.dto';
import { UpdateMailPasswordDto } from './dtos/req/update-password.req.dto';
import { ResponseTokensDto } from './dtos/res/auth.res.dto';
import { CredentialsDto } from './dtos/res/credentials.res.dto';
import { HydratedIdentitiesDto, HydratedIdentityDto } from './dtos/res/hydrated-identities.dto';
import { IdentitiesDto } from './dtos/res/identities.res.dto';
import { IdentityIdsDto } from './dtos/res/identity-ids.res.dto';
import { LimitedIdentitiesDto } from './dtos/res/limited-identities.res.dto';
import { PermissionsDto } from './dtos/res/permissions.res.dto';
import { RolesDto } from './dtos/res/roles.res.dto';
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	OnModuleInit,
	Param,
	Post,
	Query,
	Req,
	SerializeOptions,
	UseGuards,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { auth } from '@server/generated';
import { Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

@ApiBearerAuth()
@ApiTags('Auth')
@Controller()
export class AuthGatewayController implements OnModuleInit {
	private authService!: auth.AuthServiceClient;

	constructor(@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc) {}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	@Post('register')
	@IsPublic()
	@ApiOperation({ summary: 'Register with email and password' })
	@ApiResponseEntity(ResponseTokensDto)
	@SerializeOptions({ type: ResponseTokensDto })
	registerMail(@Body() body: RegisterMailDto) {
		const res = this.authService.registerMail(body);
		return res;
	}

	@Post('login')
	@IsPublic()
	@ApiOperation({ summary: 'Log in with email and password' })
	@ApiResponseEntity(ResponseTokensDto)
	@SerializeOptions({ type: ResponseTokensDto })
	loginMail(@Body() body: LoginMailDto) {
		const res = this.authService.loginMail(body);
		return res;
	}

	@Post('refresh')
	@UseGuards(JwtRefreshAuthGuard)
	@IsPublic()
	@ApiOperation({ summary: 'Refresh access tokens using a refresh token' })
	@ApiResponseEntity(ResponseTokensDto)
	@SerializeOptions({ type: ResponseTokensDto })
	refresh(@Req() req: AuthenticatedRequest) {
		const res = this.authService.refresh({ identityId: req.user.sub });
		return res;
	}

	@Post('logout-all')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Log out from all active sessions' })
	logoutAll(@Req() req: AuthenticatedRequest) {
		return this.authService.logOutAll({ identityId: req.user.sub });
	}

	@Get('google')
	@UseGuards(GoogleOAuth2Guard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Get Google redirect to login/register with OAuth2' })
	loginOrRegisterGoogle() {
		return;
	}

	@Get('google/callback')
	@UseGuards(GoogleOAuth2Guard)
	@IsPublic()
	@ApiOperation({ summary: 'Callback url for OAuth2' })
	@ApiResponseEntity(ResponseTokensDto)
	@SerializeOptions({ type: ResponseTokensDto })
	googleCallback(@Req() request: { user: auth.Tokens | boolean }): auth.Tokens | boolean {
		return request.user;
	}

	@Get('credentials/google')
	@UseGuards(GoogleOAuth2Guard)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add Google credential to existing account' })
	addGoogleCred() {
		return;
	}

	@Post('credentials/mail')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add mail credential to existing account' })
	addMailCredential(@Body() body: AddMailCredDto, @Req() request: AuthenticatedRequest) {
		return this.authService.addMailCredential({ ...body, identityId: request.user.sub });
	}

	@Delete('credentials/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete credential from existing account' })
	removeCredential(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
		return this.authService.removeCredential({ id: id, identityId: request.user.sub });
	}

	@Post(':id/roles')
	@HasRoles(Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Assign a role to someone' })
	assignRoleTo(@Body() body: AssignRoleToDto, @Param('id') identityId: string) {
		return this.authService.assignRoleTo({ ...body, identityId: identityId });
	}

	@Delete(':id/roles')
	@HasRoles(Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove a role of someone' })
	removeRoleFrom(@Body() body: RemoveRoleFromDto, @Param('id') identityId: string) {
		return this.authService.removeRoleFrom({ ...body, identityId: identityId });
	}

	@Get('identities')
	@HasRoles(Role.Admin)
	@ApiOperation({ summary: 'Find identities with roles and permissions' })
	@ApiResponseEntity(IdentitiesDto)
	@SerializeOptions({ type: IdentitiesDto })
	findIdentities(@Query() query: FindIdentitiesDto) {
		const res = this.authService.findIdentities(query);
		return res;
	}

	@Get('identities-public')
	@IsPublic()
	@ApiOperation({ summary: 'Find public identity profiles' })
	@ApiResponseEntity(LimitedIdentitiesDto)
	@SerializeOptions({ type: LimitedIdentitiesDto })
	findIdentitiesLimited(@Query() query: FindIdentitiesLimitedDto) {
		const res = this.authService.findIdentities({ ...query, hasPerms: [], hasRoles: [] });
		return res;
	}

	@Get('identity-ids')
	@IsPublic()
	@ApiOperation({ summary: 'Find identity ids only' })
	@ApiResponseEntity(IdentityIdsDto)
	@SerializeOptions({ type: IdentityIdsDto })
	findIdentityIds(@Query() query: FindIdentityIdsDto) {
		const res = this.authService.findIdentityIds(query);
		return res;
	}

	@Get('credentials')
	@ApiOperation({ summary: 'Get your credentials list' })
	@ApiResponseEntity(CredentialsDto)
	@SerializeOptions({ type: CredentialsDto })
	getCredentials(@Req() request: AuthenticatedRequest) {
		const res = this.authService.getCredentials({ identityId: request.user.sub });
		return res;
	}

	@Get('roles')
	@HasRoles(Role.Admin)
	@ApiOperation({ summary: 'Get a roles list' })
	@ApiResponseEntity(RolesDto)
	@SerializeOptions({ type: RolesDto })
	getRoleList() {
		const res = this.authService.getRoleList({});
		return res;
	}

	@Get('perms')
	@HasRoles(Role.Admin)
	@ApiOperation({ summary: 'Get a permissions list' })
	@ApiResponseEntity(PermissionsDto)
	@SerializeOptions({ type: PermissionsDto })
	getPermList() {
		const res = this.authService.getPermList({});
		return res;
	}

	@Post('my/identity')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Update your account information' })
	updateIdentity(@Body() body: UpdateIdentityDto, @Req() request: AuthenticatedRequest) {
		return this.authService.updateIdentity({ ...body, identityId: request.user.sub });
	}

	@Get('my/identity')
	@ApiOperation({ summary: 'Get your own identity information' })
	@ApiResponseEntity(HydratedIdentityDto)
	@SerializeOptions({ type: HydratedIdentityDto })
	getOwnIdentity(@Req() request: AuthenticatedRequest) {
		return this.authService.hydrateIdentity({ identityId: request.user.sub });
	}

	@Post('credentials/mail/password')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Change password' })
	updateMailPassword(@Body() body: UpdateMailPasswordDto, @Req() request: AuthenticatedRequest) {
		return this.authService.updateMailPassword({ ...body, identityId: request.user.sub });
	}

	@Get('hydrate-many')
	@IsPublic()
	@ApiOperation({ summary: 'Hydrate ids to identities' })
	@ApiResponseEntity(HydratedIdentitiesDto)
	@SerializeOptions({ type: HydratedIdentitiesDto })
	hydrateIdentities(@Query('ids') ids: string[]) {
		return this.authService.hydrateIdentities({ identityIds: ids });
	}

	@Get('hydrate')
	@IsPublic()
	@ApiOperation({ summary: 'Hydrate an id to an identity' })
	@ApiResponseEntity(HydratedIdentityDto)
	@SerializeOptions({ type: HydratedIdentityDto })
	hydrateIdentity(@Query('id') id: string) {
		return this.authService.hydrateIdentity({ identityId: id });
	}
}
