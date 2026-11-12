import { type NotificationSseService } from './notification-sse.service';
import { NotificationService } from './notification.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const setup = () => {
	const tx = {
		notification: {
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};
	const sse = { emit: jest.fn() };
	const service = new NotificationService(
		{ tx: tx } as never,
		sse as unknown as NotificationSseService,
	);
	return { tx: tx, sse: sse, service: service };
};

describe('NotificationService', () => {
	it('looks notifications up by id AND recipient', async () => {
		const { tx, service } = setup();
		tx.notification.findFirst.mockResolvedValue(null);
		await expect(service.getNotification('n1', 'intruder')).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(tx.notification.findFirst).toHaveBeenCalledWith({
			where: { id: 'n1', recipientId: 'intruder' },
		});
	});

	it('does not delete or mark read a notification the caller does not own', async () => {
		const { tx, service } = setup();
		tx.notification.findFirst.mockResolvedValue(null);
		await expect(service.deleteNotification('n1', 'intruder')).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.markAsRead('n1', 'intruder')).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.notification.delete).not.toHaveBeenCalled();
		expect(tx.notification.update).not.toHaveBeenCalled();
	});

	it('rejects a non-JSON data payload with 400 instead of crashing', async () => {
		const { tx, service } = setup();
		await expect(
			service.createNotification({
				recipientId: 'u1',
				type: 'system',
				title: 't',
				message: 'm',
				data: '{not json',
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(tx.notification.create).not.toHaveBeenCalled();
	});
});
