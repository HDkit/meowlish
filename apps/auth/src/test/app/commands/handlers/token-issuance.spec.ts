import { GoogleRegisterOrLoginCommand } from '../../../../app/commands/auth.google-register-or-login.command';
import { MailLoginCommand } from '../../../../app/commands/auth.mail-login.command';
import { RefreshCommand } from '../../../../app/commands/auth.refresh.command';
import { ValidateRefreshCommand } from '../../../../app/commands/auth.validate-refresh.command';
import { GoogleRegisterOrLoginCommandHandler } from '../../../../app/commands/handlers/google-register-or-login.handler';
import { MailLoginCommandHandler } from '../../../../app/commands/handlers/mail-login.handler';
import { RefreshCommandHandler } from '../../../../app/commands/handlers/refresh.handler';
import { ValidateRefreshCommandHandler } from '../../../../app/commands/handlers/validate-refresh.handler';
import { TokenService } from '../../../../app/services/token.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

const claims = { roles: [], permissions: [] };
const tokens = { accessToken: 'a', refreshToken: 'r' };

const setup = (opts: { locked?: boolean; credential?: object | null } = {}) => {
	const repo = {
		findOneCredential: jest
			.fn()
			.mockResolvedValue(
				opts.credential === undefined ?
					{ identityId: 'i1', secretHash: bcrypt.hashSync('Right-Pass-1!', 4) }
				:	opts.credential,
			),
		findOneById: jest.fn().mockResolvedValue({ id: 'i1', isLocked: opts.locked ?? false }),
		getClaimsOfId: jest.fn().mockResolvedValue(claims),
	};
	const publisher = { publish: jest.fn() };
	const tokenService = { generateTokens: jest.fn().mockResolvedValue(tokens) };
	return { repo: repo, publisher: publisher, tokenService: tokenService };
};

const mailCmd = (password: string) => new MailLoginCommand({ mail: 'a@b.c', password: password });

describe('mail login', () => {
	const make = (s: ReturnType<typeof setup>) =>
		new MailLoginCommandHandler(s.repo as never, s.publisher as never, s.tokenService as never);

	it('locked identity gets 403, no event, no tokens', async () => {
		const s = setup({ locked: true });
		await expect(make(s).execute(mailCmd('Right-Pass-1!'))).rejects.toEqual(
			new ForbiddenException('Account locked'),
		);
		expect(s.publisher.publish).not.toHaveBeenCalled();
		expect(s.tokenService.generateTokens).not.toHaveBeenCalled();
	});

	it('unknown email and wrong password give the identical error', async () => {
		const unknown = setup({ credential: null });
		const wrong = setup();
		const e1 = await make(unknown)
			.execute(mailCmd('x'))
			.catch((e: unknown) => e);
		const e2 = await make(wrong)
			.execute(mailCmd('x'))
			.catch((e: unknown) => e);
		expect(e1).toBeInstanceOf(UnauthorizedException);
		expect(e2).toBeInstanceOf(UnauthorizedException);
		expect((e1 as Error).message).toBe('Invalid email or password');
		expect((e2 as Error).message).toBe((e1 as Error).message);
	});

	it('valid login publishes and issues tokens', async () => {
		const s = setup();
		await expect(make(s).execute(mailCmd('Right-Pass-1!'))).resolves.toBe(tokens);
		expect(s.publisher.publish).toHaveBeenCalledTimes(1);
	});
});

describe('google login', () => {
	it('locked identity gets 403 and no event', async () => {
		const s = setup({ locked: true });
		const handler = new GoogleRegisterOrLoginCommandHandler(
			s.repo as never,
			{} as never,
			s.publisher as never,
			s.tokenService as never,
		);
		await expect(
			handler.execute(new GoogleRegisterOrLoginCommand({ identifier: 'g', username: 'u' })),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(s.publisher.publish).not.toHaveBeenCalled();
		expect(s.tokenService.generateTokens).not.toHaveBeenCalled();
	});
});

describe('refresh / validate-refresh', () => {
	it('refresh refuses a locked identity', async () => {
		const s = setup({ locked: true });
		const handler = new RefreshCommandHandler(s.repo as never, s.tokenService as never);
		await expect(handler.execute(new RefreshCommand({ identityId: 'i1' }))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(s.tokenService.generateTokens).not.toHaveBeenCalled();
	});

	it('validate-refresh refuses a locked identity', async () => {
		const s = setup({ locked: true });
		const ts = { isTokenRevoked: jest.fn().mockResolvedValue(false) };
		const handler = new ValidateRefreshCommandHandler(s.repo as never, ts as never);
		await expect(
			handler.execute(new ValidateRefreshCommand({ identityId: 'i1', iat: 1 })),
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});

describe('TokenService revocation', () => {
	const make = () => {
		const store = new Map<string, string>();
		const redis = {
			setex: jest.fn((k: string, _t: number, v: number) => store.set(k, String(v))),
			get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
		};
		const service = new TokenService(
			{} as never,
			{} as never,
			{ getOrThrow: () => redis } as never,
			{ getOrThrow: () => ({ refreshTokenExpiration: 100 }) } as never,
		);
		return Object.assign(service, { store: store });
	};

	afterEach(() => jest.useRealTimers());

	it('revokes a token issued in the same second as the revoke', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.200Z'));
		const service = make();
		const iatMs = Date.now();
		jest.setSystemTime(new Date('2026-01-01T00:00:10.700Z'));
		await service.revokeUser('u');
		expect(await service.isTokenRevoked('u', Math.floor(iatMs / 1000), iatMs)).toBe(true);
		// legacy token without iatMs also revoked
		expect(await service.isTokenRevoked('u', Math.floor(iatMs / 1000))).toBe(true);
	});

	it('keeps a token issued after the revoke valid, even in the same second', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.200Z'));
		const service = make();
		await service.revokeUser('u');
		jest.setSystemTime(new Date('2026-01-01T00:00:10.900Z'));
		const iatMs = Date.now();
		expect(await service.isTokenRevoked('u', Math.floor(iatMs / 1000), iatMs)).toBe(false);
	});

	it('a legacy seconds-valued revocation still revokes earlier tokens', async () => {
		const service = make();
		const revokedSec = 1_767_225_610; // 2026-01-01T00:00:10Z, as written by the old code
		service.store.set('jwt:blacklist:user:u', String(revokedSec));
		const before = revokedSec * 1000 - 5000;
		const after = revokedSec * 1000 + 5000;
		expect(await service.isTokenRevoked('u', Math.floor(before / 1000), before)).toBe(true);
		expect(await service.isTokenRevoked('u', Math.floor(after / 1000), after)).toBe(false);
	});
});
