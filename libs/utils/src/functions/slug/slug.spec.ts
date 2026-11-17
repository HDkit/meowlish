import { nextFreeSlug, slugify } from './slug';

describe('slugify', () => {
	it('turns Vietnamese titles into ASCII slugs', () => {
		expect(slugify('Làm thế nào để viết email chuyên nghiệp bằng tiếng Anh')).toBe(
			'lam-the-nao-de-viet-email-chuyen-nghiep-bang-tieng-anh',
		);
		expect(slugify('Đề thi IELTS Writing 6')).toBe('de-thi-ielts-writing-6');
		expect(slugify('TOEIC Reading 2 (Part 5–7)')).toBe('toeic-reading-2-part-5-7');
	});

	it('trims punctuation and gives up on nothing usable', () => {
		expect(slugify('  --Hello,   World!--  ')).toBe('hello-world');
		expect(slugify('!!!')).toBe('');
	});

	it('cuts long titles at a word boundary', () => {
		const slug = slugify('word '.repeat(40));
		expect(slug.length).toBeLessThanOrEqual(80);
		expect(slug.endsWith('-')).toBe(false);
		expect(slug.endsWith('word')).toBe(true);
	});
});

describe('nextFreeSlug', () => {
	it('adds the first free number when the slug is taken', () => {
		expect(nextFreeSlug('IELTS Writing', [])).toBe('ielts-writing');
		expect(nextFreeSlug('IELTS Writing', ['ielts-writing', 'ielts-writing-2'])).toBe(
			'ielts-writing-3',
		);
		expect(nextFreeSlug('IELTS Writing', ['ielts-writing-advanced'])).toBe('ielts-writing');
	});

	it('falls back when the title has no usable characters', () => {
		expect(nextFreeSlug('???', [], 'exam')).toBe('exam');
	});
});
