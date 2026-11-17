import { type ResourceEventsPublisher } from '../../app/events/resource-events.publisher';
import { CardImageRefsService } from '../../app/services/card-image-refs.service';
import {
	type CardImageUrlService,
	type CardImageView,
} from '../../app/services/card-image-url.service';

/** The publisher methods card image references go through. */
export const imageEvents = () => ({
	fileAdded: jest.fn(),
	filesRemoved: jest.fn(),
});

/** The real reference bookkeeping, over a mocked transaction and publisher. */
export const imageRefsOf = (tx: object, events: ReturnType<typeof imageEvents>) =>
	new CardImageRefsService({ tx: tx } as never, events as unknown as ResourceEventsPublisher);

/** Resolves every image file id to a fake public URL. */
export const fakeImageUrls = () => {
	const resolve = jest.fn((items: readonly (CardImageView | null | undefined)[]) => {
		for (const item of items) {
			if (item?.imageFileId) item.image = `https://cdn.test/public/${item.imageFileId}`;
		}
		return Promise.resolve();
	});
	return { resolve: resolve } as unknown as CardImageUrlService & { resolve: typeof resolve };
};

/** Net references each file gained (added minus removed) from the published events. */
export const refBalance = (events: ReturnType<typeof imageEvents>): Record<string, number> => {
	const net: Record<string, number> = {};
	for (const [fileId] of events.fileAdded.mock.calls as [string][]) {
		net[fileId] = (net[fileId] ?? 0) + 1;
	}
	for (const [files] of events.filesRemoved.mock.calls as [{ id: string; count: number }[]][]) {
		for (const f of files) net[f.id] = (net[f.id] ?? 0) - f.count;
	}
	for (const id of Object.keys(net)) if (net[id] === 0) delete net[id];
	return net;
};

export interface StoredCard {
	id: string;
	listId: string;
	imageFileId: string | null;
}

/**
 * A `$queryRaw` mock: `DELETE … RETURNING` statements remove and return the matching cards of
 * `cards` (so a second delete of the same card returns nothing); everything else (row locks)
 * returns []. Matches by the id array and list id the statement carries.
 */
export const queryRawOver = (cards: StoredCard[]) =>
	jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
		if (!strings.join('').includes('DELETE FROM flash_cards')) return Promise.resolve([]);
		// `… WHERE list_id = $1`, or `… WHERE id = ANY($1) AND ($2 IS NULL OR list_id = $3)`
		const ids = Array.isArray(values[0]) ? (values[0] as string[]) : undefined;
		const listId = (ids ? values[1] : values[0]) as string | null;
		const hit = cards.filter(
			c => (!ids || ids.includes(c.id)) && (listId === null || c.listId === listId),
		);
		for (const c of hit) cards.splice(cards.indexOf(c), 1);
		return Promise.resolve(hit.map(c => ({ id: c.id, imageFileId: c.imageFileId })));
	});
