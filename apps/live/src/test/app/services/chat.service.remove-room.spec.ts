import { ChatService } from '../../../app/services/chat.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

const setup = (missing = false) => {
	const order: string[] = [];
	const roomRepository = {
		removeRoom: jest.fn(async () => {
			await Promise.resolve();
			if (missing) throw new NotFoundException('Room not found');
			order.push('delete');
		}),
	};
	const outbox = {
		add: jest.fn(async () => {
			order.push('outbox');
			await Promise.resolve();
		}),
	};
	const chatGateway = { closeRoom: jest.fn(() => order.push('close')) };
	const service = new ChatService(
		{ create: jest.fn() } as never,
		chatGateway as never,
		{} as never,
		{} as never,
		roomRepository as never,
		outbox as never,
	);
	return { service: service, chatGateway: chatGateway, outbox: outbox, order: order };
};

describe('ChatService.removeRoom', () => {
	it('empties the room only after the delete and its event are written', async () => {
		const { service, order } = setup();
		await service.removeRoom('r1');
		expect(order).toEqual(['delete', 'outbox', 'close']);
	});

	it('leaves the sockets alone and sends no event when the room is missing', async () => {
		const { service, chatGateway, outbox } = setup(true);
		await expect(service.removeRoom('r1')).rejects.toBeInstanceOf(NotFoundException);
		expect(outbox.add).not.toHaveBeenCalled();
		expect(chatGateway.closeRoom).not.toHaveBeenCalled();
	});
});
