import { REFRESH_REUSE_GRACE_MS, TokenService } from '../../../app/services/token.service';
import { UnauthorizedException } from '@nestjs/common';

/** Redis fake with just the commands TokenService uses. */
class FakeRedis {
	readonly store = new Map<string, string>();
	get = jest.fn((key: string) => Promise.resolve(this.store.get(key) ?? null));
	exists = jest.fn((key: string) => Promise.resolve(this.store.has(key) ? 1 : 0));
	setex = jest.fn((key: string, _ttl: number, value: string | number) => {
		this.store.set(key, String(value));
		return Promise.resolve('OK');
	});
	set = jest.fn((key: string, value: string, ...args: (string | number)[]) => {
		if (args.includes('NX') && this.store.has(key)) return Promise.resolve(null);
		this.store.set(key, value);
		return Promise.resolve('OK');
	});
}

interface RefreshClaims {
	sub: string;
	typ: string;
	jti: string;
	fam?: string;
}

const claims = { sub: 'u', roles: [], permissions: [] };

describe('TokenService refresh rotation', () => {
	let redis: FakeRedis;
	let service: TokenService;

	/** The "JWT" is the payload as JSON, so the test can read the claims back. */
	const decode = (token: string | undefined) => JSON.parse(token ?? '') as RefreshClaims;
	const login = async () => decode((await service.generateTokens(claims, true)).refreshToken);
	const rotate = async (token: RefreshClaims) =>
		decode(
			(await service.rotateTokens(claims, { jti: token.jti, family: token.fam })).refreshToken,
		);

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
		redis = new FakeRedis();
		const signer = { signAsync: jest.fn((p: object) => Promise.resolve(JSON.stringify(p))) };
		service = new TokenService(
			signer as never,
			signer as never,
			{ getOrThrow: () => redis } as never,
			{ getOrThrow: () => ({ refreshTokenExpiration: 100 }) } as never,
		);
	});

	afterEach(() => jest.useRealTimers());

	it('every login starts its own family', async () => {
		const a = await login();
		const b = await login();
		expect(a.typ).toBe('REFRESH');
		expect(a.fam).toBeTruthy();
		expect(a.fam).not.toBe(b.fam);
		expect(a.jti).not.toBe(b.jti);
	});

	it('a refresh issues a new refresh token in the same family', async () => {
		const first = await login();
		const second = await rotate(first);
		expect(second.jti).not.toBe(first.jti);
		expect(second.fam).toBe(first.fam);
		// the next one rotates again
		const third = await rotate(second);
		expect(third.fam).toBe(first.fam);
		expect(third.jti).not.toBe(second.jti);
	});

	it('the same token again within the grace window returns the current member (tabs)', async () => {
		const first = await login();
		const second = await rotate(first);
		jest.advanceTimersByTime(REFRESH_REUSE_GRACE_MS);
		const again = await rotate(first);
		expect(again).toMatchObject({ jti: second.jti, fam: second.fam });
		// nothing was revoked: the current member keeps working
		await expect(rotate(second)).resolves.toMatchObject({ fam: first.fam });
	});

	it('reuse after the grace window revokes the whole family', async () => {
		const first = await login();
		const second = await rotate(first);
		jest.advanceTimersByTime(REFRESH_REUSE_GRACE_MS + 1);
		await expect(rotate(first)).rejects.toEqual(new UnauthorizedException('Refresh token reused'));
		// the current member (whoever holds it) is dead too
		await expect(rotate(second)).rejects.toEqual(
			new UnauthorizedException('Token has been revoked'),
		);
		// another session (family) of the same user is untouched
		await expect(rotate(await login())).resolves.toBeTruthy();
	});

	it('a pre-rotation token (no family) works once and starts a family', async () => {
		const legacy = { sub: 'u', typ: 'REFRESH', jti: 'legacy-jti' };
		const next = await rotate(legacy);
		expect(next.fam).toBeTruthy();
		jest.advanceTimersByTime(1000);
		// concurrent tabs at the deploy: same current member
		expect(await rotate(legacy)).toMatchObject({ jti: next.jti, fam: next.fam });
		jest.advanceTimersByTime(REFRESH_REUSE_GRACE_MS);
		await expect(rotate(legacy)).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(rotate(next)).rejects.toEqual(new UnauthorizedException('Token has been revoked'));
	});

	it('records each exchange for the refresh lifetime, once (SET NX EX)', async () => {
		const first = await login();
		await rotate(first);
		expect(redis.set).toHaveBeenCalledWith(
			`auth:refresh:used:${first.jti}`,
			expect.any(String),
			'EX',
			100,
			'NX',
		);
	});
});
