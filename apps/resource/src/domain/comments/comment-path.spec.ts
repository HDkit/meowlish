import {
	MAX_CHILDREN_PER_COMMENT,
	childPath,
	comparePaths,
	depthOf,
	pathSegment,
} from './comment-path';

describe('comment paths', () => {
	it('encodes sequences as fixed-width base36 segments', () => {
		expect(pathSegment(1)).toBe('0001');
		expect(pathSegment(35)).toBe('000z');
		expect(pathSegment(36)).toBe('0010');
		expect(pathSegment(MAX_CHILDREN_PER_COMMENT - 1)).toBe('zzzz');
	});

	it('rejects sequences that do not fit a segment', () => {
		expect(() => pathSegment(0)).toThrow(RangeError);
		expect(() => pathSegment(MAX_CHILDREN_PER_COMMENT)).toThrow(RangeError);
		expect(() => pathSegment(1.5)).toThrow(RangeError);
	});

	it('appends a segment per level and derives the depth', () => {
		const child = childPath('', 2);
		const grandChild = childPath(child, 10);
		expect(child).toBe('0002');
		expect(grandChild).toBe('0002000a');
		expect(depthOf('')).toBe(0);
		expect(depthOf(grandChild)).toBe(2);
	});

	it('sorts depth-first with siblings in creation order', () => {
		const paths = [
			childPath('', 10), // 3rd reply (seq 10 > 9 numerically and in base36)
			childPath(childPath('', 1), 2),
			childPath('', 9),
			childPath('', 1),
			childPath(childPath('', 1), 1),
		];
		expect([...paths].sort(comparePaths)).toEqual(['0001', '00010001', '00010002', '0009', '000a']);
	});
});
