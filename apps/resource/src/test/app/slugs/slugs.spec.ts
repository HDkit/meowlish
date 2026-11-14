import { SLUG_ATTEMPTS, isSlugConflict, withSlugRetry } from '../../../app/slugs/slugs';

const prismaError = (code: string, target?: unknown) =>
	Object.assign(new Error(code), { code: code, meta: { target: target } });

describe('isSlugConflict', () => {
	it('is true only for a unique violation on slug', () => {
		expect(isSlugConflict(prismaError('P2002', ['slug']))).toBe(true);
		expect(isSlugConflict(prismaError('P2002', 'blogs_slug_key'))).toBe(true);
		expect(isSlugConflict(prismaError('P2002', ['id']))).toBe(false);
		expect(isSlugConflict(prismaError('P2025', ['slug']))).toBe(false);
		expect(isSlugConflict(new Error('x'))).toBe(false);
		expect(isSlugConflict(null)).toBe(false);
	});
});

describe('withSlugRetry', () => {
	it('retries slug conflicts up to the limit, then rethrows', async () => {
		const attempt = jest.fn().mockRejectedValue(prismaError('P2002', ['slug']));
		await expect(withSlugRetry(attempt)).rejects.toMatchObject({ code: 'P2002' });
		expect(attempt).toHaveBeenCalledTimes(SLUG_ATTEMPTS);
	});

	it('returns the first success', async () => {
		const attempt = jest
			.fn()
			.mockRejectedValueOnce(prismaError('P2002', ['slug']))
			.mockResolvedValue('ok');
		await expect(withSlugRetry(attempt)).resolves.toBe('ok');
		expect(attempt).toHaveBeenCalledTimes(2);
	});
});
