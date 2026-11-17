import { ConnectGoogleCalendarCommand } from '../../../../app/commands/auth.connect-google-calendar.command';
import { ConnectGoogleCalendarCommandHandler } from '../../../../app/commands/handlers/connect-google-calendar.handler';
import { Identity } from '../../../../domain/entities/identity.entity';
import { ForbiddenException } from '@nestjs/common';

const setup = (isDemo: boolean) => {
	const tokenRepo = { findByIdentityId: jest.fn().mockResolvedValue(null), upsert: jest.fn() };
	const identities = {
		findOneById: jest.fn().mockResolvedValue(new Identity({ username: 'u', isDemo: isDemo })),
	};
	const handler = new ConnectGoogleCalendarCommandHandler(tokenRepo as never, identities as never);
	return { handler: handler, tokenRepo: tokenRepo };
};

const cmd = () =>
	new ConnectGoogleCalendarCommand({
		identityId: 'i1',
		accessToken: 'a',
		refreshToken: 'r',
		expiresAt: Date.now() + 3_600_000,
		scopes: 'calendar',
	});

describe('ConnectGoogleCalendarCommandHandler', () => {
	it("the demo account can't store Google Calendar tokens", async () => {
		const { handler, tokenRepo } = setup(true);
		await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
		expect(tokenRepo.upsert).not.toHaveBeenCalled();
	});

	it('a normal identity connects', async () => {
		const { handler, tokenRepo } = setup(false);
		await handler.execute(cmd());
		expect(tokenRepo.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ identityId: 'i1', refreshToken: 'r' }),
		);
	});
});
