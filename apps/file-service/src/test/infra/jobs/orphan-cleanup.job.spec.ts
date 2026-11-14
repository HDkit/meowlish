import { OrphanCleanupWorker } from '../../../infra/jobs/orphan-cleanup.job';

describe('OrphanCleanupWorker', () => {
	const setup = () => {
		const calls: string[] = [];
		let inTransaction = false;
		const txHost = {
			withTransaction: jest.fn(async (_options: unknown, fn: () => Promise<void>) => {
				inTransaction = true;
				calls.push('begin');
				try {
					await fn();
					calls.push('commit');
				} catch (e) {
					calls.push('rollback');
					throw e;
				} finally {
					inTransaction = false;
				}
			}),
		};
		const repo = {
			lockOrphanedFiles: jest.fn(() => {
				calls.push(`lock:${String(inTransaction)}`);
				return Promise.resolve([
					{ id: 'a', isPublic: true },
					{ id: 'b', isPublic: false },
				]);
			}),
			removeOrphaned: jest.fn((ids: string[]) => {
				calls.push(`rows:${ids.join(',')}:${String(inTransaction)}`);
				return Promise.resolve();
			}),
		};
		const fileService = {
			removeObjects: jest.fn((files: { id: string }[]) => {
				calls.push(`objects:${files.map(f => f.id).join(',')}`);
				return Promise.resolve(files.map(f => f.id));
			}),
		};
		const logger = { error: jest.fn() };
		const worker = new OrphanCleanupWorker(
			repo as never,
			fileService as never,
			logger as never,
			txHost as never,
		);
		return { worker: worker, repo: repo, fileService: fileService, logger: logger, calls: calls };
	};

	const now = new Date('2026-11-12T12:00:00Z');

	it('locks the orphans, deletes their objects, then their rows, in one transaction', async () => {
		const { worker, calls } = setup();
		await worker.cleanupOrphans(now);
		expect(calls).toEqual(['begin', 'lock:true', 'objects:a,b', 'rows:a,b:true', 'commit']);
	});

	it('only considers files untouched for at least 1 hour', async () => {
		const { worker, repo } = setup();
		await worker.cleanupOrphans(now);
		expect(repo.lockOrphanedFiles).toHaveBeenCalledWith(
			new Date('2026-11-12T11:00:00Z'),
			expect.any(Number),
		);
	});

	it('keeps the rows whose object could not be deleted', async () => {
		const { worker, repo, fileService } = setup();
		fileService.removeObjects.mockResolvedValueOnce(['b']);
		await worker.cleanupOrphans(now);
		expect(repo.removeOrphaned).toHaveBeenCalledWith(['b']);
	});

	it('keeps every row when the object storage request fails', async () => {
		const { worker, repo, fileService, calls } = setup();
		fileService.removeObjects.mockRejectedValueOnce(new Error('minio down'));
		await expect(worker.cleanupOrphans(now)).rejects.toThrow('minio down');
		expect(repo.removeOrphaned).not.toHaveBeenCalled();
		expect(calls.at(-1)).toBe('rollback');
	});

	it('does nothing when there are no orphans', async () => {
		const { worker, repo, fileService } = setup();
		repo.lockOrphanedFiles.mockResolvedValueOnce([]);
		await worker.cleanupOrphans(now);
		expect(fileService.removeObjects).not.toHaveBeenCalled();
		expect(repo.removeOrphaned).not.toHaveBeenCalled();
	});

	it('logs instead of failing the job', async () => {
		const { worker, logger, fileService } = setup();
		fileService.removeObjects.mockRejectedValueOnce(new Error('minio down'));
		await worker.process({ name: 'cleanup-orphaned-files' } as never);
		expect(logger.error).toHaveBeenCalled();
	});
});
