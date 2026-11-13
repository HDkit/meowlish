import { Identity } from '../../../domain/entities/identity.entity';
import { LogoutAllCommand, LogoutAllCommandPayload } from '../auth.logout-all.command';
import { LogoutAllCommandHandler } from './logout-all.handler';
import { ForbiddenException } from '@nestjs/common';

const setup = (isDemo: boolean) => {
	const repo = {
		findOneById: jest.fn().mockResolvedValue(new Identity({ username: 'u', isDemo: isDemo })),
	};
	const tokens = { revokeUser: jest.fn() };
	const handler = new LogoutAllCommandHandler(repo as never, tokens as never);
	return { handler: handler, tokens: tokens };
};

const cmd = () => new LogoutAllCommand(new LogoutAllCommandPayload('i1'));

describe('LogoutAllCommandHandler', () => {
	it("the demo account can't revoke every tester's sessions", async () => {
		const { handler, tokens } = setup(true);
		await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
		expect(tokens.revokeUser).not.toHaveBeenCalled();
	});

	it('a normal identity revokes all of its sessions', async () => {
		const { handler, tokens } = setup(false);
		await handler.execute(cmd());
		expect(tokens.revokeUser).toHaveBeenCalledWith('i1');
	});
});
