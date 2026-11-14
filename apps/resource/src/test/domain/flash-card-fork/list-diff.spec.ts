import {
	type CardContent,
	differingFields,
	parseCardContent,
} from '../../../domain/flash-card-fork/card-content';
import {
	type ForkCard,
	type OriginalCard,
	computeListDiff,
	countConflicts,
	evaluateChanges,
	planUpstreamSync,
} from '../../../domain/flash-card-fork/list-diff';

const content = (overrides: Partial<CardContent> = {}): CardContent => ({
	word: 'apple',
	definition: 'quả táo',
	partOfSpeech: 'noun',
	pronunciation: null,
	examples: ['An apple a day'],
	notes: null,
	tags: ['fruit'],
	image: null,
	...overrides,
});

const synced = new Date('2026-05-01');
const before = new Date('2026-04-01');
const after = new Date('2026-06-01');

const original = (id: string, c: CardContent, createdAt = before): OriginalCard => ({
	id: id,
	createdAt: createdAt,
	content: c,
});

const copy = (
	id: string,
	originCardId: string | null,
	c: CardContent,
	snapshot: CardContent | null = c,
): ForkCard => ({ id: id, originCardId: originCardId, originSnapshot: snapshot, content: c });

describe('differingFields', () => {
	it('treats empty text and null as equal and compares arrays by value', () => {
		expect(
			differingFields(content({ notes: '' }), content({ notes: null, tags: ['fruit'] }), [
				'notes',
				'tags',
			]),
		).toEqual([]);
		expect(differingFields(content(), content({ tags: ['fruit', 'red'] }), ['tags'])).toEqual([
			'tags',
		]);
	});
});

describe('parseCardContent', () => {
	it('reads a stored snapshot and rejects other JSON', () => {
		expect(parseCardContent(content())).toEqual(content());
		expect(parseCardContent({ word: 'x' })).toBeNull();
		expect(parseCardContent(null)).toBeNull();
	});
});

describe('computeListDiff', () => {
	it('reports cards added, modified (field level) and removed in the copy', () => {
		const changes = computeListDiff(
			[
				copy('f1', 'o1', content({ definition: 'trái táo', notes: 'mới' }), content()),
				copy('f3', null, content({ word: 'pear' }), null),
			],
			[original('o1', content()), original('o2', content({ word: 'banana' }))],
			synced,
		);
		expect(changes.added).toEqual([{ sourceCardId: 'f3', card: content({ word: 'pear' }) }]);
		expect(changes.modified).toEqual([
			{
				targetCardId: 'o1',
				sourceCardId: 'f1',
				fields: ['definition', 'notes'],
				base: content(),
				proposed: content({ definition: 'trái táo', notes: 'mới' }),
			},
		]);
		expect(changes.removed).toEqual([{ targetCardId: 'o2', base: content({ word: 'banana' }) }]);
	});

	it('does not report the original’s own later edits as changes of the copy', () => {
		const changes = computeListDiff(
			[copy('f1', 'o1', content(), content())],
			[original('o1', content({ definition: 'táo (đã sửa)' }))],
			synced,
		);
		expect(changes.modified).toEqual([]);
	});

	it('reports only the fields the copy changed when both sides edited a card', () => {
		const changes = computeListDiff(
			[copy('f1', 'o1', content({ notes: 'của tôi' }), content())],
			[original('o1', content({ definition: 'táo (đã sửa)' }))],
			synced,
		);
		expect(changes.modified[0].fields).toEqual(['notes']);
		expect(changes.modified[0].base.definition).toBe('táo (đã sửa)');
	});

	it('ignores cards created in the original after the copy and copies of deleted originals', () => {
		const changes = computeListDiff(
			[copy('f1', 'gone', content({ word: 'edited' }), content())],
			[original('o9', content({ word: 'new upstream' }), after)],
			synced,
		);
		expect(changes).toEqual({ added: [], modified: [], removed: [] });
	});

	it('compares against the original directly when a copied card has no snapshot', () => {
		const changes = computeListDiff(
			[copy('f1', 'o1', content({ word: 'apples' }), null)],
			[original('o1', content())],
			synced,
		);
		expect(changes.modified[0].fields).toEqual(['word']);
	});
});

describe('evaluateChanges', () => {
	const changes = computeListDiff(
		[copy('f1', 'o1', content({ definition: 'trái táo' }), content())],
		[original('o1', content()), original('o2', content({ word: 'banana' }))],
		synced,
	);

	it('has no conflicts when the original is unchanged since the proposal', () => {
		const evaluated = evaluateChanges(
			changes,
			new Map([
				['o1', content()],
				['o2', content({ word: 'banana' })],
			]),
		);
		expect(countConflicts(evaluated)).toBe(0);
		expect(evaluated.modified[0].targetMissing).toBe(false);
	});

	it('flags a modification whose field the owner changed since, but not other fields', () => {
		const evaluated = evaluateChanges(
			changes,
			new Map([
				['o1', content({ definition: 'táo đỏ' })],
				['o2', content({ word: 'banana' })],
			]),
		);
		expect(evaluated.modified[0].conflict).toBe(true);

		const otherField = evaluateChanges(
			changes,
			new Map([
				['o1', content({ notes: 'ghi chú' })],
				['o2', content({ word: 'banana' })],
			]),
		);
		expect(otherField.modified[0].conflict).toBe(false);
	});

	it('does not flag a field the owner already changed to the proposed value', () => {
		const evaluated = evaluateChanges(
			changes,
			new Map([['o1', content({ definition: 'trái táo' })]]),
		);
		expect(evaluated.modified[0].conflict).toBe(false);
	});

	it('flags a removal of a card edited since, and skips cards already deleted', () => {
		const evaluated = evaluateChanges(
			changes,
			new Map([['o2', content({ word: 'banana', notes: 'mới' })]]),
		);
		expect(evaluated.removed[0].conflict).toBe(true);
		expect(evaluated.modified[0]).toMatchObject({ targetMissing: true, conflict: false });
		expect(countConflicts(evaluated)).toBe(1);
	});
});

describe('planUpstreamSync', () => {
	it('takes upstream edits of unchanged copies, adds new cards and drops deleted ones', () => {
		const plan = planUpstreamSync(
			[
				copy('f1', 'o1', content(), content()),
				copy('f2', 'o2', content({ word: 'kiwi' }), content({ word: 'kiwi' })),
				copy('f3', null, content({ word: 'mine' }), null),
			],
			[
				original('o1', content({ definition: 'táo (đã sửa)' })),
				original('o9', content({ word: 'new' }), after),
			],
			synced,
		);
		expect(plan.update).toEqual([
			{
				forkCardId: 'f1',
				content: content({ definition: 'táo (đã sửa)' }),
				contentChanged: true,
			},
		]);
		expect(plan.add.map(c => c.id)).toEqual(['o9']);
		expect(plan.remove).toEqual(['f2']);
		expect(plan.skipped).toBe(0);
	});

	it('skips cards the user changed, on both sides or deleted upstream', () => {
		const plan = planUpstreamSync(
			[
				copy('f1', 'o1', content({ notes: 'của tôi' }), content()),
				copy('f2', 'o2', content({ word: 'kiwi!' }), content({ word: 'kiwi' })),
			],
			[original('o1', content({ definition: 'táo (đã sửa)' }))],
			synced,
		);
		expect(plan.update).toEqual([]);
		expect(plan.remove).toEqual([]);
		expect(plan.skipped).toBe(2);
	});

	it('only moves the snapshot when both sides already match', () => {
		const plan = planUpstreamSync(
			[copy('f1', 'o1', content({ word: 'apples' }), content())],
			[original('o1', content({ word: 'apples' }))],
			synced,
		);
		expect(plan.update).toEqual([
			{ forkCardId: 'f1', content: content({ word: 'apples' }), contentChanged: false },
		]);
	});

	it('does not re-add original cards that existed at the last sync (deleted in the copy)', () => {
		const plan = planUpstreamSync([], [original('o1', content())], synced);
		expect(plan.add).toEqual([]);
	});
});
