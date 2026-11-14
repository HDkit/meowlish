import { ChatService } from '../../../app/services/chat.service';

// ids sort like their send time: '25' is the newest message
const log = (id: string) => ({ id: id, uid: 'u1', message: `m${id}`, createdAt: new Date(0) });
const ids = (n: number, from = 1) =>
	Array.from({ length: n }, (_, i) => String(from + i).padStart(2, '0'));
const newestFirst = (list: string[]) => [...list].sort().reverse();

const setup = (rows: string[]) => {
	const repo = {
		// mimics the Prisma query: newest first, `take: limit * direction` around the cursor
		getChatLogsOf: jest.fn(
			(_roomId: string, o: { id?: string; direction?: number; limit?: number }) => {
				const all = newestFirst(rows);
				const limit = o.limit ?? 20;
				const cursor = o.id;
				if ((o.direction ?? 1) === -1) {
					const newer = cursor ? all.filter(r => r > cursor) : all;
					return Promise.resolve(newer.slice(-limit).map(log));
				}
				const older = cursor ? all.filter(r => r < cursor) : all;
				return Promise.resolve(older.slice(0, limit).map(log));
			},
		),
	};
	// readable stand-in for the signed cursor helper
	const helper = {
		encodeCursor: (v: object) => JSON.stringify(v),
		decodeCursor: (c: string) => JSON.parse(c) as unknown,
	};
	const service = new ChatService(
		{ create: () => helper } as never,
		{} as never,
		repo,
		{} as never,
		{} as never,
		{} as never,
	);
	return { repo: repo, service: service };
};

const idsOf = (page: { chats: { id: string }[] }) => page.chats.map(c => c.id);

describe('ChatService.getChatLogsOf paging', () => {
	it('returns the latest messages first and pages towards older ones', async () => {
		const { service } = setup(ids(60));
		const first = await service.getChatLogsOf('r1', { limit: 50 });
		expect(idsOf(first)).toEqual(newestFirst(ids(50, 11)));
		expect(first.prevCursor).toBe('');
		expect(first.nextCursor).not.toBe('');

		const older = await service.getChatLogsOf('r1', { cursor: first.nextCursor });
		expect(idsOf(older)).toEqual(newestFirst(ids(10)));
		expect(older.nextCursor).toBe('');
		expect(older.prevCursor).not.toBe('');

		const back = await service.getChatLogsOf('r1', { cursor: older.prevCursor });
		expect(idsOf(back)).toEqual(newestFirst(ids(50, 11)));
		expect(back.prevCursor).toBe('');
		expect(back.nextCursor).not.toBe('');
	});

	it('has no cursors for an empty room, so a client cannot loop back to the first page', async () => {
		const { service } = setup([]);
		const page = await service.getChatLogsOf('r1', { limit: 50 });
		expect(page).toEqual({ chats: [], nextCursor: '', prevCursor: '' });
	});

	it('has no next page when the room has exactly one page', async () => {
		const { repo, service } = setup(ids(10));
		const page = await service.getChatLogsOf('r1', { limit: 10 });
		expect(idsOf(page)).toHaveLength(10);
		expect(page.nextCursor).toBe('');
		// one extra row is fetched to know whether there is more
		expect(repo.getChatLogsOf).toHaveBeenCalledWith('r1', expect.objectContaining({ limit: 11 }));
	});
});
