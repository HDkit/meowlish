import { ChatGateway } from './chat.gateway';
import { type ConfigService } from '@nestjs/config';
import { type AppLoggerService } from '@server/logger';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	publicKeyEncoding: { type: 'spki', format: 'pem' },
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const logger = { warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

const makeGateway = (canJoin: () => Promise<boolean> = () => Promise.resolve(true)) => {
	const config = { get: () => publicKey } as unknown as ConfigService;
	return new ChatGateway(
		logger as unknown as AppLoggerService,
		{ canJoinRoom: jest.fn(canJoin) } as never,
		config,
	);
};

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
		const token = jwt.sign({ sub: 'user-1' }, privateKey, { algorithm: 'RS256' });
		const socket = makeSocket({ headers: { authorization: `Bearer ${token}` } });
		await makeGateway().handleConnection(socket as never);
		expect(socket.disconnect).not.toHaveBeenCalled();
		expect(socket.data.uid).toBe('user-1');
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
