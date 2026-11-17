import { ChatService } from '../../../app/services/chat.service';

const room = (id: string) => ({ id: id, name: `room-${id}` });
const ids = (n: number, from = 1) =>
	Array.from({ length: n }, (_, i) => String(from + i).padStart(2, '0'));

const setup = (rows: string[]) => {
	const repo = {
		getRoomList: jest.fn(
			(o: { id?: string; direction?: number; limit?: number; name?: string }) => {
				const all = rows.filter(r => !o.name || `room-${r}`.includes(o.name));
				const limit = o.limit ?? 20;
				if ((o.direction ?? 1) === -1) {
					const cursor = o.id;
					const before = cursor ? all.filter(r => r < cursor) : all;
					return Promise.resolve(before.slice(-limit).map(room));
				}
				const cursor = o.id;
				const after = cursor ? all.filter(r => r > cursor) : all;
				return Promise.resolve(after.slice(0, limit).map(room));
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
		{} as never,
		repo,
		{} as never,
		{} as never,
	);
	return { repo: repo, service: service };
};

describe('ChatService.getRoomList paging', () => {
	it('has no next page on the last page and no previous page on the first', async () => {
		const { service } = setup(ids(25));
		const first = await service.getRoomList({ limit: 20 });
		expect(first.rooms).toHaveLength(20);
		expect(first.prevCursor).toBe('');
		expect(first.nextCursor).not.toBe('');
		const second = await service.getRoomList({ cursor: first.nextCursor });
		expect(second.rooms.map(r => r.id)).toEqual(ids(5, 21));
		expect(second.nextCursor).toBe('');
		const back = await service.getRoomList({ cursor: second.prevCursor });
		expect(back.rooms.map(r => r.id)).toEqual(ids(20));
		expect(back.prevCursor).toBe('');
		expect(back.nextCursor).not.toBe('');
	});

	it('keeps the name filter across pages through the cursor', async () => {
		const { repo, service } = setup(ids(30));
		const first = await service.getRoomList({ limit: 2, name: 'room-1' });
		expect(first.rooms.map(r => r.id)).toEqual(['10', '11']);
		// the client "forgets" the name: the cursor still carries it
		const next = await service.getRoomList({ cursor: first.nextCursor });
		expect(next.rooms.map(r => r.id)).toEqual(['12', '13']);
		expect(repo.getRoomList).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'room-1' }));
	});
});
