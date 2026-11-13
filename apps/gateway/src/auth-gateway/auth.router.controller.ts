import { HasPermissions } from '../auth/decorators/permissions.decorator';
import { IsPublic } from '../auth/decorators/public.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { CookieIssuanceGuard } from '../auth/guards/cookie-issuance.guard';
import {
	GoogleOAuth2CallbackGuard,
	GoogleOAuth2Guard,
	type GoogleOAuthFlow,
} from '../auth/guards/google-oauth2.guard';
import { JwtRefreshAuthGuard } from '../auth/guards/jwt-refresh-auth.guard';
import { IEnvVars } from '../configs/config';
import {
	StrictThrottleByMail,
	StrictThrottleByRefreshToken,
	StrictThrottleBySession,
} from '../throttle';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import { AUTH_CLIENT } from './constants/auth';
import { AddMailCredDto } from './dtos/req/add-mail-cred.req.dto';
import { AssignRoleToDto } from './dtos/req/assign-role-to.req.dto';
import { ConnectGoogleCalendarDto } from './dtos/req/connect-google-calendar.req.dto';
import { ExchangeGoogleCalendarCodeDto } from './dtos/req/exchange-google-calendar-code.req.dto';
import { ExchangeGoogleLoginTokenDto } from './dtos/req/exchange-google-login-token.req.dto';
import { FindIdentitiesLimitedDto } from './dtos/req/find-identities-limited.req.dto';
import { FindIdentitiesDto } from './dtos/req/find-identities.req.dto';
import { FindIdentityIdsDto } from './dtos/req/find-identity-ids.req.dto';
import { HydrateIdentitiesQueryDto } from './dtos/req/hydrate-identities.query.dto';
import { LoginMailDto } from './dtos/req/login-mail.req.dto';
import { RegisterMailDto } from './dtos/req/register-mail.req.dto';
import { RemoveRoleFromDto } from './dtos/req/remove-role-from.req.dto';
import { UpdateIdentityDto } from './dtos/req/update-identity.req.dto';
import { UpdateMailPasswordDto } from './dtos/req/update-password.req.dto';
import { CredentialsDto } from './dtos/res/credentials.res.dto';
import {
	GoogleCalendarAccessTokenDto,
	GoogleCalendarConnectionDto,
} from './dtos/res/google-calendar.res.dto';
import {
	HydratedIdentityDto,
	PublicIdentitiesDto,
	PublicIdentityDto,
} from './dtos/res/hydrated-identities.dto';
import { IdentitiesDto } from './dtos/res/identities.res.dto';
import { IdentityIdsDto } from './dtos/res/identity-ids.res.dto';
import { LimitedIdentitiesDto } from './dtos/res/limited-identities.res.dto';
import { PermissionsDto } from './dtos/res/permissions.res.dto';
import { RolesDto } from './dtos/res/roles.res.dto';
import { RedisService } from '@liaoliaots/nestjs-redis';
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
	Res,
	SerializeOptions,
	UnauthorizedException,
	UnsupportedMediaTypeException,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { auth } from '@server/generated';
import { Permission, Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { Observable, lastValueFrom } from 'rxjs';

const SETS_COOKIES =
	'Sets the `access_token` (Path=/) and `refresh_token` (Path=/api/v1/auth) HttpOnly cookies; `data` is null.';

const FRONTEND_QUERY_DESCRIPTION =
	'Origin of the frontend starting the flow (`location.origin`). Google calls back through that frontend and the user lands on its login callback page. Must be the default frontend or listed in GOOGLE_OAUTH_FRONTENDS (400 otherwise); omit it for the default.';

@ApiBearerAuth()
@ApiTags('Auth')
@Controller()
export class AuthGatewayController implements OnModuleInit {
	private authService!: auth.AuthServiceClient;
	private readonly redis: Redis;

	constructor(
		@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc,
		private readonly configService: ConfigService<IEnvVars>,
		private readonly redisService: RedisService,
	) {
		this.redis = this.redisService.getOrThrow();
	}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	private get env(): string {
		return this.configService.getOrThrow('env', { infer: true });
	}

	/** Puts the tokens in HttpOnly cookies; the JSON body never carries them. */
	private async issueCookies(req: Request, res: Response, tokens$: Observable<auth.Tokens>) {
		setAuthCookies(req, res, await lastValueFrom(tokens$), this.env);
		return null;
	}

	@Post('register')
	@UseGuards(CookieIssuanceGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Register with email and password',
		description: SETS_COOKIES,
	})
	@StrictThrottleByMail()
	registerMail(
		@Body() body: RegisterMailDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.issueCookies(req, res, this.authService.registerMail(body));
	}

	@Post('login')
	@UseGuards(CookieIssuanceGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Log in with email and password', description: SETS_COOKIES })
	@StrictThrottleByMail()
	loginMail(
		@Body() body: LoginMailDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.issueCookies(req, res, this.authService.loginMail(body));
	}

	@Post('refresh')
	@UseGuards(CookieIssuanceGuard, JwtRefreshAuthGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Refresh access tokens using a refresh token',
		description: `Reads the refresh token from the \`refresh_token\` cookie, else \`Authorization: Bearer\`. ${SETS_COOKIES}`,
	})
	@StrictThrottleByRefreshToken()
	refresh(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
		return this.issueCookies(req, res, this.authService.refresh({ identityId: req.user.sub }));
	}

	@Post('logout')
	@UseGuards(CookieIssuanceGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Log out of this browser',
		description:
			'Clears the `access_token` and `refresh_token` cookies. Tokens are not revoked server-side; use /logout-all for that.',
	})
	logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		clearAuthCookies(req, res, this.env);
		return null;
	}

	@Post('logout-all')
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Log out from all active sessions',
		description: 'Revokes every token of this identity and clears the auth cookies.',
	})
	async logoutAll(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
		await lastValueFrom(this.authService.logOutAll({ identityId: req.user.sub }));
		clearAuthCookies(req, res, this.env);
		return null;
	}

	@Get('google')
	@UseGuards(GoogleOAuth2Guard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Get Google redirect to login/register with OAuth2' })
	@ApiQuery({
		name: 'frontend',
		required: false,
		description: FRONTEND_QUERY_DESCRIPTION,
		example: 'https://meowlish-fe-share.vercel.app',
	})
	loginOrRegisterGoogle() {
		return;
	}

	@Get('google/callback')
	@UseGuards(GoogleOAuth2CallbackGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Callback url for OAuth2' })
	async googleCallback(
		@Req() request: { user: auth.Tokens | boolean; googleOAuth: GoogleOAuthFlow },
		@Res() res: Response,
	) {
		const loginToken = crypto.randomUUID();
		await this.redis.setex(
			`oauth2:google:loginToken:${loginToken}`,
			60,
			JSON.stringify(request.user),
		);
		// GoogleOAuth2CallbackGuard resolved which frontend this flow started on
		const url = new URL(request.googleOAuth.frontend.loginRedirectUrl);
		url.searchParams.set('loginToken', loginToken);
		return res.redirect(url.toString());
	}

	@Post('google/tokens')
	@UseGuards(CookieIssuanceGuard)
	@IsPublic()
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Exchange the one-time login token for session cookies',
		description: `Send the \`loginToken\` that /google/callback put on the frontend redirect URL as a JSON body. ${SETS_COOKIES}`,
	})
	async getGoogleTokens(
		@Body() body: ExchangeGoogleLoginTokenDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		// JSON only: a cross-site <form> can't send it, so even a browser that sends neither
		// Sec-Fetch-Site nor Origin can't be made to log in as someone else (login CSRF).
		if (!req.is('application/json')) {
			throw new UnsupportedMediaTypeException('Send the login token as application/json');
		}
		const loginToken = body.loginToken;
		const data = await this.redis.get(`oauth2:google:loginToken:${loginToken}`);
		if (!data) {
			throw new UnauthorizedException('Invalid or expired login token');
		}
		await this.redis.del(`oauth2:google:loginToken:${loginToken}`);
		const result = JSON.parse(data) as auth.Tokens | boolean;
		// linking flow stores `true`: the browser already has its session, nothing to set
		if (typeof result === 'object' && result.accessToken) {
			setAuthCookies(req, res, result, this.env);
		}
		return null;
	}

	@Get('credentials/google')
	@UseGuards(GoogleOAuth2Guard)
	@ApiEmptyResponseEntity()
	@ApiOperation({
		summary: 'Add Google credential to existing account',
		description:
			'Open with a top-level navigation (not fetch/XHR): the `access_token` cookie authenticates it and the `oauth2_state` cookie set here must come back on /google/callback.',
	})
	@ApiQuery({
		name: 'frontend',
		required: false,
		description: FRONTEND_QUERY_DESCRIPTION,
		example: 'https://meowlish-fe-share.vercel.app',
	})
	addGoogleCred() {
		return;
	}

	@Post('credentials/mail')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add mail credential to existing account' })
	@StrictThrottleBySession()
	addMailCredential(@Body() body: AddMailCredDto, @Req() request: AuthenticatedRequest) {
		return this.authService.addMailCredential({ ...body, identityId: request.user.sub });
	}

	@Delete('credentials/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete credential from existing account' })
	removeCredential(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
		return this.authService.removeCredential({ id: id, identityId: request.user.sub });
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
		const res = this.authService.findIdentities({
			usernameOrCredIdentifierOrId: query.usernameOrCredIdentifier,
			// Public search: never match emails/ids, or anyone could probe who is registered.
			usernameOnly: true,
			cursor: query.cursor,
			limit: query.limit,
			hasPerms: [],
			hasRoles: [],
		});
		return res;
	}

	@Get('identity-ids')
	@IsPublic()
	@ApiOperation({ summary: 'Find identity ids only' })
	@ApiResponseEntity(IdentityIdsDto)
	@SerializeOptions({ type: IdentityIdsDto })
	findIdentityIds(@Query() query: FindIdentityIdsDto) {
		const res = this.authService.findIdentityIds({ ...query, usernameOnly: true });
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
	@StrictThrottleBySession()
	updateMailPassword(@Body() body: UpdateMailPasswordDto, @Req() request: AuthenticatedRequest) {
		return this.authService.updateMailPassword({ ...body, identityId: request.user.sub });
	}

	@Get('hydrate-many')
	@IsPublic()
	@ApiOperation({ summary: 'Hydrate ids to identities' })
	@ApiResponseEntity(PublicIdentitiesDto)
	@SerializeOptions({ type: PublicIdentitiesDto })
	hydrateIdentities(@Query() query: HydrateIdentitiesQueryDto) {
		return this.authService.hydrateIdentities({ identityIds: query.ids });
	}

	@Get('hydrate')
	@IsPublic()
	@ApiOperation({ summary: 'Hydrate an id to an identity' })
	@ApiResponseEntity(PublicIdentityDto)
	@SerializeOptions({ type: PublicIdentityDto })
	hydrateIdentity(@Query('id') id: string) {
		return this.authService.hydrateIdentity({ identityId: id });
	}

	@Post(':id/lock')
	@HasPermissions(Permission.USER_LOCK)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Lock an identity account' })
	lockIdentity(@Param('id') identityId: string, @Req() request: AuthenticatedRequest) {
		return this.authService.lockIdentity({ identityId: identityId, lockedBy: request.user.sub });
	}

	@Delete(':id/lock')
	@HasPermissions(Permission.USER_UNLOCK)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Unlock an identity account' })
	unlockIdentity(@Param('id') identityId: string) {
		return this.authService.unlockIdentity({ identityId: identityId });
	}

	@Get('identity/search/phone')
	@HasRoles(Role.Admin)
	@ApiOperation({ summary: 'Search identities by phone number (admins)' })
	@ApiResponseEntity(IdentitiesDto)
	@SerializeOptions({ type: IdentitiesDto })
	findIdentitiesByPhone(
		@Query('phoneNumber') phoneNumber: string,
		@Query('cursor') cursor?: string,
		@Query('limit') limit?: number,
	) {
		return this.authService.findIdentitiesByPhone({
			phoneNumber: phoneNumber,
			cursor: cursor,
			limit: limit,
		});
	}

	@Post('google/calendar/exchange-code')
	@ApiOperation({ summary: 'Exchange Google auth code for Calendar tokens and connect' })
	@ApiResponseEntity(GoogleCalendarConnectionDto)
	@SerializeOptions({ type: GoogleCalendarConnectionDto })
	async exchangeGoogleCalendarCode(
		@Body() body: ExchangeGoogleCalendarCodeDto,
		@Req() request: AuthenticatedRequest,
	) {
		const config = this.configService.getOrThrow('googleOAuth2', { infer: true });

		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code: body.code,
				client_id: config.clientId,
				client_secret: config.secret,
				redirect_uri: 'postmessage',
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenRes.ok) {
			throw new UnauthorizedException('Failed to exchange Google authorization code');
		}

		const tokens = (await tokenRes.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
			scope?: string;
		};

		return lastValueFrom(
			this.authService.connectGoogleCalendar({
				identityId: request.user.sub,
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token ?? '',
				expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
				scopes: tokens.scope ?? '',
			}),
		);
	}

	@Post('google/calendar/connect')
	@ApiOperation({ summary: 'Connect Google Calendar account' })
	@ApiResponseEntity(GoogleCalendarConnectionDto)
	@SerializeOptions({ type: GoogleCalendarConnectionDto })
	connectGoogleCalendar(
		@Body() body: ConnectGoogleCalendarDto,
		@Req() request: AuthenticatedRequest,
	) {
		return this.authService.connectGoogleCalendar({
			identityId: request.user.sub,
			accessToken: body.accessToken,
			refreshToken: body.refreshToken,
			expiresAt: body.expiresAt,
			scopes: body.scopes,
		});
	}

	@Delete('google/calendar/connect')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Disconnect Google Calendar account' })
	disconnectGoogleCalendar(@Req() request: AuthenticatedRequest) {
		return this.authService.disconnectGoogleCalendar({ identityId: request.user.sub });
	}

	@Get('google/calendar/token')
	@ApiOperation({
		summary: 'Get a short-lived Google Calendar access token (refreshed server-side)',
	})
	@ApiResponseEntity(GoogleCalendarAccessTokenDto)
	@SerializeOptions({ type: GoogleCalendarAccessTokenDto })
	getGoogleCalendarToken(@Req() request: AuthenticatedRequest) {
		return this.authService.getGoogleCalendarToken({ identityId: request.user.sub });
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
}
