import { UserLockedHandler } from '../../../../app/events/handlers/user-locked.handler';
import { createEnvelope } from '@server/messaging';

jest.mock('@nestjs-cls/transactional', () => ({
	...jest.requireActual<object>('@nestjs-cls/transactional'),
	Transactional: () => () => undefined,
}));
jest.mock('nestjs-cls', () => ({
	...jest.requireActual<object>('nestjs-cls'),
	UseCls: () => () => undefined,
}));

const setup = (claimed = true) => {
	const chatGateway = { disconnectAllOf: jest.fn().mockResolvedValue(undefined) };
	const inbox = { claim: jest.fn().mockResolvedValue(claimed) };
	return {
		chatGateway: chatGateway,
		inbox: inbox,
		handler: new UserLockedHandler(chatGateway as never, inbox as never),
	};
};

describe('UserLockedHandler (S17)', () => {
	it('disconnects the locked user once per event', async () => {
		const { chatGateway, inbox, handler } = setup();
		const event = createEnvelope('auth.user.locked', { identityId: 'u1', lockedBy: 'admin' });
		await handler.handle(event);
		expect(inbox.claim).toHaveBeenCalledWith(event.id, 'live.events.user.locked');
		expect(chatGateway.disconnectAllOf).toHaveBeenCalledWith('u1');
	});

	it('skips a redelivered event', async () => {
		const { chatGateway, handler } = setup(false);
		await handler.handle(createEnvelope('auth.user.locked', { identityId: 'u1' }));
		expect(chatGateway.disconnectAllOf).not.toHaveBeenCalled();
	});
});
