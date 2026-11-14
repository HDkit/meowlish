import { ChatGateway } from '../../../app/services/chat.gateway';
import { type ConfigService } from '@nestjs/config';
import { type AppLoggerService } from '@server/logger';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';
import { of, throwError } from 'rxjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	publicKeyEncoding: { type: 'spki', format: 'pem' },
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const logger = { warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

/** Same claims as auth's access tokens (`typ` ACCESS, roles, permissions). */
const accessToken = (sub: string, extra: object = { typ: 'ACCESS', roles: [], permissions: [] }) =>
	jwt.sign({ sub: sub, ...extra }, privateKey, { algorithm: 'RS256' });

/** auth's ValidateAccess: resolves, or errors for a revoked token / locked account. */
let validateAccess = jest.fn(() => of({}));

const makeGateway = (canJoin: () => Promise<boolean> = () => Promise.resolve(true)) => {
	const config = { get: () => publicKey } as unknown as ConfigService;
	const gateway = new ChatGateway(
		logger as unknown as AppLoggerService,
		{ canJoinRoom: jest.fn(canJoin) } as never,
		config,
		{
			getService: () => ({
				validateAccess: (...args: unknown[]) => validateAccess(...(args as [])),
			}),
		} as never,
	);
	gateway.onModuleInit();
	return gateway;
};

beforeEach(() => {
	validateAccess = jest.fn(() => of({}));
});

const makeSocket = (handshake: {
	auth?: object;
	query?: Record<string, string>;
	headers?: Record<string, string>;
}) => ({
	handshake: { auth: {}, query: {}, headers: {}, ...handshake },
	data: {} as { uid?: string },
	join: jest.fn(),
	disconnect: jest.fn(),
});

describe('ChatGateway authentication', () => {
	it('rejects the old raw-uid Authorization header', async () => {
		const socket = makeSocket({ headers: { authorization: 'victim-uid' } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
		expect(socket.data.uid).toBeUndefined();
	});

	it('rejects a token signed with another key', async () => {
		const forged = jwt.sign({ sub: 'victim' }, 'not-the-key', { algorithm: 'HS256' });
		const socket = makeSocket({ auth: { token: forged } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
	});

	it('takes the uid from a valid RS256 token', async () => {
		const token = accessToken('user-1');
		const socket = makeSocket({ headers: { authorization: `Bearer ${token}` } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).not.toHaveBeenCalled();
		expect(socket.data.uid).toBe('user-1');
	});

	it('socket accepts the cookie', async () => {
		const token = accessToken('user-2');
		const socket = makeSocket({ headers: { cookie: `theme=dark; access_token=${token}` } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).not.toHaveBeenCalled();
		expect(socket.data.uid).toBe('user-2');
	});

	it('prefers the cookie over the header', async () => {
		const cookie = accessToken('from-cookie');
		const header = accessToken('from-header');
		const socket = makeSocket({
			headers: { cookie: `access_token=${cookie}`, authorization: `Bearer ${header}` },
		});
		await makeGateway().handleConnection(socket as never);
		expect(socket.data.uid).toBe('from-cookie');
	});

	it('rejects a refresh token (same key, no roles)', async () => {
		for (const claims of [{ typ: 'REFRESH' }, {}]) {
			const socket = makeSocket({ auth: { token: accessToken('user-1', claims) } });
			await makeGateway().handleConnection(socket as never);
			expect(socket.disconnect).toHaveBeenCalledWith(true);
			expect(socket.data.uid).toBeUndefined();
		}
	});

	it('refuses a revoked token or locked account (auth ValidateAccess fails)', async () => {
		validateAccess = jest.fn(() => throwError(() => new Error('Token has been revoked')));
		const socket = makeSocket({ auth: { token: accessToken('user-1') } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
		expect(socket.data.uid).toBeUndefined();
	});

	it('disconnects every socket of a locked user', async () => {
		const gateway = makeGateway();
		const disconnectSockets = jest.fn();
		const mine = { data: { uid: 'locked' }, disconnect: jest.fn() };
		const other = { data: { uid: 'someone' }, disconnect: jest.fn() };
		gateway.server = {
			in: jest.fn(() => ({ disconnectSockets: disconnectSockets })),
			fetchSockets: () => Promise.resolve([mine, other]),
		} as never;
		await gateway.disconnectAllOf('locked');
		expect(disconnectSockets).toHaveBeenCalledWith(true);
		expect(mine.disconnect).toHaveBeenCalledWith(true);
		expect(other.disconnect).not.toHaveBeenCalled();
	});

	it('accepts a pre-typ access token (roles, no typ)', async () => {
		const socket = makeSocket({
			auth: { token: accessToken('user-1', { roles: ['STUDENT'], permissions: [] }) },
		});
		await makeGateway().handleConnection(socket as never);
		expect(socket.data.uid).toBe('user-1');
	});

	it('refuses to leave a non-room id such as its own uid room', async () => {
		const socket = { ...makeSocket({}), leave: jest.fn() };
		socket.data.uid = 'me';
		await expect(makeGateway().handleLeave('me', socket as never)).rejects.toThrow();
		expect(socket.leave).not.toHaveBeenCalled();
	});

	it('kicks a banned user by socket uid even if it left its uid room', async () => {
		const gateway = makeGateway();
		const mine = { data: { uid: 'banned' }, leave: jest.fn() };
		const other = { data: { uid: 'someone' }, leave: jest.fn() };
		const socketsLeave = jest.fn();
		gateway.server = {
			in: jest.fn((room: string) => ({
				socketsLeave: socketsLeave,
				fetchSockets: () => Promise.resolve(room === 'room-1' ? [mine, other] : []),
			})),
		} as never;
		await gateway.disconnectUser('banned', 'room-1');
		expect(mine.leave).toHaveBeenCalledWith('room-1');
		expect(other.leave).not.toHaveBeenCalled();
	});

	it('refuses to join a non-room id, e.g. another user uid room', async () => {
		const socket = makeSocket({});
		socket.data.uid = 'me';
		await expect(makeGateway().handleJoin('not-a-uuid', socket as never)).rejects.toThrow();
		expect(socket.join).not.toHaveBeenCalled();
	});

	it('fails closed when the ban check errors', async () => {
		const socket = makeSocket({});
		socket.data.uid = 'me';
		const gateway = makeGateway(() => Promise.reject(new Error('db down')));
		await expect(
			gateway.handleJoin('7b0c6c4e-3c1e-4f6e-9c63-1f4f2f6f2b11', socket as never),
		).rejects.toThrow();
		expect(socket.join).not.toHaveBeenCalled();
	});
});
