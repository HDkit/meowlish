import { CursorPaginationHelper } from './cursor';
import { BadRequestException } from '@nestjs/common';

describe('CursorPaginationHelper.decodeCursor', () => {
	const helper = new CursorPaginationHelper('x'.repeat(32));

	it('round-trips a cursor it encoded', () => {
		expect(helper.decodeCursor(helper.encodeCursor({ id: 'a1' }))).toEqual({ id: 'a1' });
	});

	it.each(['garbage', 'abc.def', `${helper.encodeCursor({ id: 'a1' })}x`])(
		'answers a malformed or tampered cursor (%s) with 400, not 502',
		cursor => {
			expect(() => helper.decodeCursor(cursor)).toThrow(BadRequestException);
		},
	);
});
