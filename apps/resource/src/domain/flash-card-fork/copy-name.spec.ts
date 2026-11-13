import { copyName } from './copy-name';

describe('copyName', () => {
	it('keeps the name when the user has no list with it', () => {
		expect(copyName('IELTS', new Set(['TOEIC']))).toBe('IELTS');
	});

	it('marks a copy and numbers further copies', () => {
		expect(copyName('IELTS', new Set(['IELTS']))).toBe('IELTS (bản sao)');
		expect(copyName('IELTS', new Set(['IELTS', 'IELTS (bản sao)']))).toBe('IELTS (bản sao 2)');
	});
});
