import { ChatService } from '../../../app/services/chat.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

const setup = (missing = false) => {
	const time = new Date('2026-11-20T12:00:00.000Z');
	const roomRepository = {
		updateRoomSchedule: jest.fn(async () => {
			await Promise.resolve();
			if (missing) throw new NotFoundException('Room not found');
			return { scheduledLiveUrl: 'https://youtube.com/live/abc', scheduledTime: time };
		}),
	};
	const chatGateway = { announceRoomSchedule: jest.fn() };
	const service = new ChatService(
		{ create: jest.fn() } as never,
		chatGateway as never,
		{} as never,
		{} as never,
		roomRepository as never,
		{} as never,
	);
	return { service: service, chatGateway: chatGateway, roomRepository: roomRepository, time: time };
};

describe('ChatService.updateRoomSchedule', () => {
	it('tells the room the schedule as saved', async () => {
		const { service, chatGateway, roomRepository, time } = setup();
		await service.updateRoomSchedule('r1', {
			url: 'https://youtube.com/live/abc',
			setTimeNull: false,
		});
		expect(roomRepository.updateRoomSchedule).toHaveBeenCalledWith('r1', {
			url: 'https://youtube.com/live/abc',
			time: undefined,
		});
		expect(chatGateway.announceRoomSchedule).toHaveBeenCalledWith('r1', {
			scheduledLiveUrl: 'https://youtube.com/live/abc',
			scheduledTime: time,
		});
	});

	it('clears fields with null', async () => {
		const { service, roomRepository } = setup();
		await service.updateRoomSchedule('r1', { setUrlNull: true, setTimeNull: true });
		expect(roomRepository.updateRoomSchedule).toHaveBeenCalledWith('r1', { url: null, time: null });
	});

	it('announces nothing when the room is missing', async () => {
		const { service, chatGateway } = setup(true);
		await expect(service.updateRoomSchedule('r1', { url: 'x' })).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(chatGateway.announceRoomSchedule).not.toHaveBeenCalled();
	});
});
