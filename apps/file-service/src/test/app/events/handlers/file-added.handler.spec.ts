import { FileAddedHandler } from '../../../../app/events/handlers/file-added.handler';
import { type IFileRepository } from '../../../../domain/repositories/file.repository';
import { type AppLoggerService } from '@server/logger';
import { type InboxService } from '@server/messaging';

jest.mock('@nestjs-cls/transactional', () => ({
	Transactional: () => () => undefined,
}));
jest.mock('nestjs-cls', () => ({ UseCls: () => () => undefined }));

describe('FileAddedHandler', () => {
	const envelope = (fileId: string) => ({
		id: 'evt-1',
		type: 'exam.file.added',
		occurredAt: '2026-11-15T00:00:00.000Z',
		payload: { fileId: fileId },
	});

	const setup = (updated: number, claimed = true) => {
		const fileRepository = { incrementRef: jest.fn().mockResolvedValue(updated) };
		const inbox = { claim: jest.fn().mockResolvedValue(claimed) };
		const logger = { warn: jest.fn() };
		const handler = new FileAddedHandler(
			fileRepository as unknown as IFileRepository,
			inbox as unknown as InboxService,
			logger as unknown as AppLoggerService,
		);
		return { handler: handler, fileRepository: fileRepository, logger: logger };
	};

	it('adds a reference to the file', async () => {
		const { handler, fileRepository, logger } = setup(1);
		await handler.handle(envelope('f1'));
		expect(fileRepository.incrementRef).toHaveBeenCalledWith(['f1']);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('warns when the file no longer exists', async () => {
		const { handler, logger } = setup(0);
		await handler.handle(envelope('gone'));
		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('gone'));
	});

	it('skips a redelivered event', async () => {
		const { handler, fileRepository } = setup(1, false);
		await handler.handle(envelope('f1'));
		expect(fileRepository.incrementRef).not.toHaveBeenCalled();
	});
});
