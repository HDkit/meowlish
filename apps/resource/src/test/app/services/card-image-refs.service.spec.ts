import { imageEvents, imageRefsOf, queryRawOver, refBalance } from '../../helpers/card-images';

const setup = () => {
	const cards = [
		{ id: 'a', listId: 'l1', imageFileId: 'img' },
		{ id: 'b', listId: 'l1', imageFileId: 'img' },
		{ id: 'c', listId: 'l2', imageFileId: 'other' },
	];
	const tx = { $queryRaw: queryRawOver(cards) };
	const events = imageEvents();
	return { tx: tx, events: events, cards: cards, refs: imageRefsOf(tx, events) };
};

describe('CardImageRefsService', () => {
	it('adds one reference per id and skips cards without an image', async () => {
		const { events, refs } = setup();
		await refs.added(['x', null, undefined, 'x']);
		expect(events.fileAdded.mock.calls).toEqual([['x'], ['x']]);
	});

	it('releases repeats of one file as one entry with a count', async () => {
		const { events, refs } = setup();
		await refs.released(['x', 'y', null, 'x']);
		expect(events.filesRemoved).toHaveBeenCalledWith([
			{ id: 'x', count: 2 },
			{ id: 'y', count: 1 },
		]);
	});

	it('replaces only when the image actually changes', async () => {
		const { events, refs } = setup();
		await refs.replaced('x', 'x');
		await refs.replaced(null, undefined);
		expect(refBalance(events)).toEqual({});
		await refs.replaced('x', 'y');
		await refs.replaced(null, 'z');
		await refs.replaced('z', null);
		expect(refBalance(events)).toEqual({ x: -1, y: 1 });
	});

	it("deletes a list's cards and releases what they held", async () => {
		const { events, cards, refs } = setup();
		await expect(refs.deleteCards({ listId: 'l1' })).resolves.toEqual(['a', 'b']);
		expect(refBalance(events)).toEqual({ img: -2 });
		expect(cards.map(c => c.id)).toEqual(['c']);
	});

	it('deletes cards by id, limited to a list when given', async () => {
		const { events, refs } = setup();
		await expect(refs.deleteCards({ ids: ['a', 'c'], listId: 'l1' })).resolves.toEqual(['a']);
		await expect(refs.deleteCards({ ids: ['c'] })).resolves.toEqual(['c']);
		expect(refBalance(events)).toEqual({ img: -1, other: -1 });
	});

	it('does nothing for an empty id list (no statement)', async () => {
		const { tx, events, refs } = setup();
		await expect(refs.deleteCards({ ids: [] })).resolves.toEqual([]);
		expect(tx.$queryRaw).not.toHaveBeenCalled();
		expect(events.filesRemoved).not.toHaveBeenCalled();
	});
});
