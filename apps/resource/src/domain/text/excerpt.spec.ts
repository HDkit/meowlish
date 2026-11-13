import { toExcerpt } from './excerpt';

describe('toExcerpt', () => {
	it('strips Markdown syntax, images, code and tables', () => {
		const md = [
			'# Title',
			'',
			'![cover](https://x/y.jpg)',
			'> a **quoted** [link](https://x)',
			'- item _one_',
			'```ts',
			'const x = 1;',
			'```',
			'| a | b |',
			'|---|:-:|',
			'| 1 | 2 |',
		].join('\n');
		expect(toExcerpt(md)).toBe('Title a quoted link item one a b 1 2');
	});

	it('cuts long text at a word boundary with an ellipsis', () => {
		const text = 'word '.repeat(100);
		const excerpt = toExcerpt(text, 23);
		expect(excerpt).toBe('word word word word…');
	});

	it('keeps short text as is', () => {
		expect(toExcerpt('Hello  world')).toBe('Hello world');
	});
});
