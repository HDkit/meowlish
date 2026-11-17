import { ChatService } from '../../../app/services/chat.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const setup = (owner?: string | null) => {
	const roomRepository = {
		getRoomOwner: jest.fn().mockResolvedValue(owner),
		banUserFrom: jest.fn().mockResolvedValue(undefined),
		unbanUserFrom: jest.fn().mockResolvedValue(undefined),
	};
	const chatGateway = { disconnectUser: jest.fn() };
	const service = new ChatService(
		{ create: jest.fn() } as never,
		chatGateway as never,
		{} as never,
		{} as never,
		roomRepository as never,
		{} as never,
	);
	return { service: service, roomRepository: roomRepository, chatGateway: chatGateway };
};

const owner = { requesterId: 'mod-a', privileged: false };
const otherMod = { requesterId: 'mod-b', privileged: false };
const admin = { requesterId: 'admin-1', privileged: true };

describe('ChatService ban/unban ownership', () => {
	it('owner can ban and unban', async () => {
		const { service, roomRepository } = setup('mod-a');
		await service.banUserFrom('r1', 'u1', 'spam', owner);
		await service.unbanUserFrom('r1', 'u1', owner);
		expect(roomRepository.banUserFrom).toHaveBeenCalledWith('r1', 'u1', 'spam');
		expect(roomRepository.unbanUserFrom).toHaveBeenCalledWith('r1', 'u1');
	});

	it("admin can ban in someone else's room", async () => {
		const { service, roomRepository } = setup('mod-a');
		await service.banUserFrom('r1', 'u1', 'spam', admin);
		expect(roomRepository.banUserFrom).toHaveBeenCalledTimes(1);
	});

	it('another mod gets 403 and nobody is banned or disconnected', async () => {
		const { service, roomRepository, chatGateway } = setup('mod-a');
		await expect(service.banUserFrom('r1', 'u1', 'x', otherMod)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		await expect(service.unbanUserFrom('r1', 'u1', otherMod)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(roomRepository.banUserFrom).not.toHaveBeenCalled();
		expect(roomRepository.unbanUserFrom).not.toHaveBeenCalled();
		expect(chatGateway.disconnectUser).not.toHaveBeenCalled();
	});

	it('missing room is 404', async () => {
		const { service } = setup(undefined);
		await expect(service.banUserFrom('r1', 'u1', 'x', admin)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.unbanUserFrom('r1', 'u1', admin)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('room with no owner: only admin', async () => {
		const { service, roomRepository } = setup(null);
		await expect(service.banUserFrom('r1', 'u1', 'x', owner)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		await service.banUserFrom('r1', 'u1', 'x', admin);
		expect(roomRepository.banUserFrom).toHaveBeenCalledTimes(1);
	});
});
