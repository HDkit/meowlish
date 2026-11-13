import { Identity } from '../../../domain/entities/identity.entity';
import {
	GoogleCalendarAccessTokenDto,
	GoogleCalendarConnectionDto,
} from '../../../presentation/dtos/res/google-calendar-token.res.dto';
import { ConnectGoogleCalendarCommand } from '../../commands/auth.connect-google-calendar.command';
import { ConnectGoogleCalendarCommandHandler } from '../../commands/handlers/connect-google-calendar.handler';
import { GetGoogleCalendarTokenQuery } from '../auth.get-google-calendar-token.query';
import { GetGoogleCalendarTokenQueryHandler } from './get-google-calendar-token.handler';
import { plainToInstance } from 'class-transformer';

const stored = (expiresAt: number) => ({
	identityId: 'i1',
	accessToken: 'old-access',
	refreshToken: 'SECRET-REFRESH',
	expiresAt: new Date(expiresAt),
	scopes: 'calendar',
});

const setup = (row: ReturnType<typeof stored> | null) => {
	const repo = {
		findByIdentityId: jest.fn().mockResolvedValue(row),
		upsert: jest.fn(),
		delete: jest.fn(),
	};
	const config = { getOrThrow: jest.fn().mockReturnValue({ clientId: 'cid', secret: 'sec' }) };
	const handler = new GetGoogleCalendarTokenQueryHandler(repo, config as never);
	return { handler: handler, repo: repo };
};

const query = () => new GetGoogleCalendarTokenQuery({ identityId: 'i1' });

describe('Google Calendar token', () => {
	afterEach(() => jest.restoreAllMocks());

	it('calendar token route never returns the refresh token', async () => {
		const { handler } = setup(stored(Date.now() + 3_600_000));
		const fetchMock = jest.spyOn(global, 'fetch');
		const result = await handler.execute(query());
		expect(fetchMock).not.toHaveBeenCalled();
		expect(result).toEqual({
			accessToken: 'old-access',
			expiresAt: result.expiresAt,
		});
		const serialized = JSON.stringify(
			plainToInstance(GoogleCalendarAccessTokenDto, result, { excludeExtraneousValues: true }),
		);
		expect(serialized).not.toContain('SECRET-REFRESH');
		expect(Object.keys(result).sort()).toEqual(['accessToken', 'expiresAt']);
	});

	it('expired access token is refreshed server-side', async () => {
		const { handler, repo } = setup(stored(Date.now() - 1000));
		const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ access_token: 'new-access', expires_in: 3600 }),
		} as Response);

		const result = await handler.execute(query());

		const init = fetchMock.mock.calls[0][1] as RequestInit;
		const body = init.body as URLSearchParams;
		expect(body.get('grant_type')).toBe('refresh_token');
		expect(body.get('refresh_token')).toBe('SECRET-REFRESH');
		expect(body.get('client_id')).toBe('cid');
		expect(result.accessToken).toBe('new-access');
		expect(result.expiresAt).toBeGreaterThan(Date.now());
		expect(result).not.toHaveProperty('refreshToken');
		expect(repo.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ accessToken: 'new-access', refreshToken: 'SECRET-REFRESH' }),
		);
	});

	it('connect returns status only', async () => {
		const repo = {
			findByIdentityId: jest.fn().mockResolvedValue(stored(0)),
			upsert: jest.fn(),
		};
		const identities = {
			findOneById: jest.fn().mockResolvedValue(new Identity({ id: 'i1', username: 'u' })),
		};
		const handler = new ConnectGoogleCalendarCommandHandler(repo as never, identities as never);
		const expiresAt = Date.now() + 3_600_000;
		const result = await handler.execute(
			new ConnectGoogleCalendarCommand({
				identityId: 'i1',
				accessToken: 'a',
				refreshToken: '',
				expiresAt: expiresAt,
				scopes: 'calendar',
			}),
		);
		expect(result).toEqual({ expiresAt: expiresAt });
		// empty refresh token on re-consent keeps the stored one
		expect(repo.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ refreshToken: 'SECRET-REFRESH' }),
		);
		const serialized = plainToInstance(
			GoogleCalendarConnectionDto,
			{ connected: true, ...result, refreshToken: 'x' },
			{ excludeExtraneousValues: true },
		);
		expect(Object.keys(serialized).sort()).toEqual(['connected', 'expiresAt']);
	});
});
