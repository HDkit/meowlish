import { jitter, retryOnConflict } from './retry-on-conflict';

describe('retryOnConflict', () => {
	const isConflict = (e: unknown) => e instanceof Error && e.message === 'conflict';

	it('returns the result without retrying on success', async () => {
		const fn = jest.fn().mockResolvedValue(1);
		await expect(retryOnConflict(fn, { attempts: 3, isConflict: isConflict })).resolves.toBe(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries conflicts and rethrows after the last attempt', async () => {
		const fn = jest.fn().mockRejectedValue(new Error('conflict'));
		await expect(retryOnConflict(fn, { attempts: 3, isConflict: isConflict })).rejects.toThrow(
			'conflict',
		);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('rethrows other errors immediately', async () => {
		const fn = jest.fn().mockRejectedValue(new Error('boom'));
		await expect(retryOnConflict(fn, { attempts: 3, isConflict: isConflict })).rejects.toThrow(
			'boom',
		);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('waits delayMs(retry) between tries', async () => {
		const fn = jest.fn().mockRejectedValueOnce(new Error('conflict')).mockResolvedValue(2);
		const delayMs = jest.fn().mockReturnValue(1);
		await expect(
			retryOnConflict(fn, { attempts: 3, isConflict: isConflict, delayMs: delayMs }),
		).resolves.toBe(2);
		expect(delayMs).toHaveBeenCalledWith(1);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('jitter stays within its bounds', () => {
		const delay = jitter(5, 25);
		for (let i = 0; i < 100; i++) {
			const ms = delay();
			expect(ms).toBeGreaterThanOrEqual(5);
			expect(ms).toBeLessThan(25);
		}
	});
});
