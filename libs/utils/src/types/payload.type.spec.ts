import { isAccessTokenPayload, isRefreshTokenPayload } from './payload.type';

describe('token type checks', () => {
	const access = { sub: 'u', roles: ['STUDENT'], permissions: [], iat: 1, exp: 2 };
	const refresh = { sub: 'u', iat: 1, exp: 2 };

	it('tells tokens apart by typ', () => {
		expect(isAccessTokenPayload({ ...access, typ: 'ACCESS' })).toBe(true);
		expect(isRefreshTokenPayload({ ...access, typ: 'ACCESS' })).toBe(false);
		expect(isRefreshTokenPayload({ ...refresh, typ: 'REFRESH' })).toBe(true);
		expect(isAccessTokenPayload({ ...refresh, typ: 'REFRESH' })).toBe(false);
	});

	it('tells pre-typ tokens apart by their claims', () => {
		expect(isAccessTokenPayload(access)).toBe(true);
		expect(isRefreshTokenPayload(access)).toBe(false);
		expect(isRefreshTokenPayload(refresh)).toBe(true);
		expect(isAccessTokenPayload(refresh)).toBe(false);
	});

	it('trusts typ over the shape and rejects unknown values', () => {
		// a REFRESH typ never passes as access, even with roles added
		expect(isAccessTokenPayload({ ...access, typ: 'REFRESH' })).toBe(false);
		expect(isRefreshTokenPayload({ ...refresh, typ: 'SOMETHING' })).toBe(false);
		expect(isAccessTokenPayload(null)).toBe(false);
		expect(isRefreshTokenPayload('token')).toBe(false);
	});
});
