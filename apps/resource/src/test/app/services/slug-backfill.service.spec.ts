import { SlugBackfillService } from '../../../app/services/slug-backfill.service';
import { Logger } from '@nestjs/common';

describe('SlugBackfillService', () => {
	it('logs a failure instead of throwing, so startup carries on', async () => {
		const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		const tx = {
			blog: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
			forumThread: { findMany: jest.fn() },
		};
		const service = new SlugBackfillService({ tx: tx } as never);

		await expect(service.run()).resolves.toBeUndefined();
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});

	it('does not make startup wait for the backfill', () => {
		const service = new SlugBackfillService({ tx: {} } as never);
		const run = jest.spyOn(service, 'run').mockReturnValue(new Promise(() => undefined));
		expect(service.onApplicationBootstrap()).toBeUndefined();
		expect(run).toHaveBeenCalled();
	});
});
