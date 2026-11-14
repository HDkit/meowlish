import { AuthGatewayController } from '../../auth-gateway/auth.router.controller';
import { CookieIssuanceGuard } from '../../auth/guards/cookie-issuance.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of, throwError } from 'rxjs';

const setup = () => {
	const authService = {
		updateMailPassword: jest.fn(() => of({})),
		refresh: jest.fn(() => of({ accessToken: 'new-at', refreshToken: 'new-rt' })),
		logOutAll: jest.fn(() => of({})),
	};
	const controller = new AuthGatewayController(
		{ getService: () => authService } as never,
		{ getOrThrow: () => 'development' } as never,
		{ getOrThrow: () => ({}) } as never,
	);
	controller.onModuleInit();
	const req = { user: { sub: 'user-1' }, secure: false, headers: {} };
	const res = { cookie: jest.fn(), clearCookie: jest.fn() };
	return { controller: controller, authService: authService, req: req, res: res };
};

const body = { id: 'c1', currentPassword: 'Old-Pass-1!', password: 'New-Pass-2!' };

describe('AuthGatewayController password change', () => {
	it('keeps this browser signed in with fresh cookies', async () => {
		const { controller, authService, req, res } = setup();
		await expect(
			controller.updateMailPassword(body, req as never, res as never),
		).resolves.toBeNull();
		expect(authService.updateMailPassword).toHaveBeenCalledWith({ ...body, identityId: 'user-1' });
		// the new session is issued after the change (which revoked every token)
		expect(authService.refresh).toHaveBeenCalledWith({ identityId: 'user-1' });
		expect(authService.updateMailPassword.mock.invocationCallOrder[0]).toBeLessThan(
			authService.refresh.mock.invocationCallOrder[0],
		);
		expect(res.cookie).toHaveBeenCalledWith('access_token', 'new-at', expect.anything());
		expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'new-rt', expect.anything());
		expect(res.clearCookie).not.toHaveBeenCalled();
	});

	it('clears the cookies when the new session cannot be issued', async () => {
		const { controller, authService, req, res } = setup();
		authService.refresh.mockReturnValueOnce(throwError(() => new Error('locked')));
		await expect(
			controller.updateMailPassword(body, req as never, res as never),
		).resolves.toBeNull();
		expect(res.cookie).not.toHaveBeenCalled();
		expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.anything());
		expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.anything());
	});

	it('a refused change (wrong password) touches no cookies', async () => {
		const { controller, authService, req, res } = setup();
		const error = { code: 16, details: 'Wrong password' };
		authService.updateMailPassword.mockReturnValueOnce(throwError(() => error));
		await expect(controller.updateMailPassword(body, req as never, res as never)).rejects.toBe(
			error,
		);
		expect(authService.refresh).not.toHaveBeenCalled();
		expect(res.cookie).not.toHaveBeenCalled();
		expect(res.clearCookie).not.toHaveBeenCalled();
	});
});

describe('AuthGatewayController cookie-issuing routes', () => {
	it.each([
		'registerMail',
		'loginMail',
		'refresh',
		'logout',
		'logoutAll',
		'getGoogleTokens',
		'updateMailPassword',
	] as const)('%s is guarded by CookieIssuanceGuard', method => {
		const handler = Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, method)
			?.value as object;
		// untyped boundary: reflect-metadata returns `any`
		const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;
		expect(guards).toContain(CookieIssuanceGuard);
	});
});
