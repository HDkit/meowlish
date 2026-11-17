import { RoomPrismaRepositoryImpl } from '../../../../app/infra/repositories/room.prisma.repository';
import { NotFoundException } from '@nestjs/common';

jest.mock('@prisma-client/live', () => ({
	Prisma: {
		PrismaClientKnownRequestError: class extends Error {
			constructor(public code: string) {
				super(code);
			}
		},
	},
}));

const { Prisma } = jest.requireMock<{
	Prisma: { PrismaClientKnownRequestError: new (code: string) => Error };
}>('@prisma-client/live');

const p2025 = () => new Prisma.PrismaClientKnownRequestError('P2025');

const setup = () => {
	const tx = { room: { update: jest.fn() } };
	const repo = new RoomPrismaRepositoryImpl({ tx: tx } as never);
	return { tx: tx, repo: repo };
};

describe('RoomPrismaRepositoryImpl', () => {
	it('deletes only a room that is not deleted yet', async () => {
		const { tx, repo } = setup();
		await repo.removeRoom('r1');
		expect(tx.room.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'r1', isDeleted: false } }),
		);
	});

	it('answers 404 for a missing or already deleted room', async () => {
		const { tx, repo } = setup();
		tx.room.update.mockRejectedValue(p2025());
		await expect(repo.removeRoom('r1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(repo.updateRoomSchedule('r1', { url: null })).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('rethrows other database errors unchanged', async () => {
		const { tx, repo } = setup();
		const boom = new Error('connection lost');
		tx.room.update.mockRejectedValue(boom);
		await expect(repo.removeRoom('r1')).rejects.toBe(boom);
	});
});
