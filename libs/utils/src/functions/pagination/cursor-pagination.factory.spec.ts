import { CursorPaginationHelper } from './cursor';
import { CursorPaginationFactory } from './cursor-pagination.factory';
import { type ConfigService } from '@nestjs/config';

const config = (values: Record<string, string | undefined>) =>
	({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('CursorPaginationFactory', () => {
	const secret = 'x'.repeat(32);

	it('round-trips a cursor within one namespace', () => {
		const helper = new CursorPaginationFactory(config({ cursorSecret: secret })).create('A');
		const cursor = helper.encodeCursor({ limit: 10 });
		expect(helper.decodeCursor<{ limit: number }>(cursor)).toEqual({ limit: 10 });
	});

	it('rejects a cursor from another namespace', () => {
		const factory = new CursorPaginationFactory(config({ cursorSecret: secret }));
		const cursor = factory.create('A').encodeCursor({ limit: 10 });
		expect(() => factory.create('B').decodeCursor(cursor)).toThrow('Invalid cursor');
	});

	it('rejects a cursor signed with the old guessable host/port key', () => {
		const forged = new CursorPaginationHelper('localhost50053FindExams').encodeCursor({
			sortBy: { key: 'updatedAt', direction: 'ASC, (SELECT 1)' },
		});
		const helper = new CursorPaginationFactory(config({ cursorSecret: secret })).create(
			'FindExams',
		);
		expect(() => helper.decodeCursor(forged)).toThrow('Invalid cursor');
	});

	it('uses a random key when no secret is configured', () => {
		const a = new CursorPaginationFactory(config({ env: 'development' })).create('A');
		const b = new CursorPaginationFactory(config({ env: 'development' })).create('A');
		expect(() => b.decodeCursor(a.encodeCursor({}))).toThrow('Invalid cursor');
	});
});
