import { RoomReadPrismaRepositoryImpl } from '../../../../app/infra/repositories/room.read.prisma.repository';

const at = (iso: string) => new Date(iso);

const setup = () => {
	const tx = {
		room: {
			findMany: jest.fn().mockResolvedValue([
				{
					id: 'r1',
					name: 'IELTS',
					scheduledLiveUrl: null,
					scheduledTime: at('2026-12-01T10:00:00Z'),
					createdBy: 'mod-1',
					isDeleted: false,
				},
				{
					id: 'r2',
					name: 'TOEIC',
					scheduledLiveUrl: 'https://meet',
					scheduledTime: null,
					createdBy: null,
					isDeleted: false,
				},
			]),
		},
		log: {
			findMany: jest.fn().mockResolvedValue([
				{
					id: 'l9',
					roomId: 'r1',
					fromId: 'u2',
					message: 'newest',
					createdAt: at('2026-11-13T10:00:00Z'),
				},
			]),
		},
	};
	const repo = new RoomReadPrismaRepositoryImpl({ tx: tx } as never);
	return { tx: tx, repo: repo };
};

describe('RoomReadPrismaRepositoryImpl.getRoomList', () => {
	it('returns each room with its schedule, creator and newest message', async () => {
		const { repo } = setup();
		const rooms = await repo.getRoomList();
		expect(rooms).toEqual([
			{
				id: 'r1',
				name: 'IELTS',
				scheduledLiveUrl: undefined,
				scheduledDate: at('2026-12-01T10:00:00Z'),
				createdBy: 'mod-1',
				lastMessage: {
					id: 'l9',
					uid: 'u2',
					message: 'newest',
					createdAt: at('2026-11-13T10:00:00Z'),
				},
			},
			{
				id: 'r2',
				name: 'TOEIC',
				scheduledLiveUrl: 'https://meet',
				scheduledDate: undefined,
				createdBy: undefined,
				lastMessage: undefined,
			},
		]);
	});

	it('loads the newest message of every listed room in one query', async () => {
		const { tx, repo } = setup();
		await repo.getRoomList();
		expect(tx.log.findMany).toHaveBeenCalledTimes(1);
		expect(tx.log.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { roomId: { in: ['r1', 'r2'] } },
				distinct: ['roomId'],
				orderBy: [{ roomId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
			}),
		);
	});
});
