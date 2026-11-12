import { type ResourceEventsPublisher } from '../events/resource-events.publisher';
import { ReportService } from './report.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const report = (overrides: Record<string, unknown> = {}) => ({
	id: 'r1',
	reportedBy: 'owner',
	type: 'bug',
	status: 'pending',
	title: 'Broken',
	description: 'desc',
	targetType: null,
	targetId: null,
	resolvedBy: null,
	adminResponse: null,
	createdAt: new Date('2026-01-01'),
	updatedAt: new Date('2026-01-01'),
	files: [],
	...overrides,
});

const firstArg = (fn: jest.Mock): unknown => (fn.mock.calls as unknown[][])[0][0];
const whereOf = (fn: jest.Mock): unknown => (firstArg(fn) as { where: unknown }).where;

// Writing methods are @Transactional(); register the static host they look up (no-op adapter).
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const setup = () => {
	const tx = {
		report: {
			findUnique: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			create: jest.fn().mockResolvedValue(report()),
			update: jest.fn(),
			deleteMany: jest.fn(),
		},
		reportFile: { upsert: jest.fn(), deleteMany: jest.fn() },
	};
	const events = { reportStatusChanged: jest.fn() };
	const files = { assertOwnedBy: jest.fn().mockResolvedValue(undefined) };
	const service = new ReportService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
		files as never,
	);
	return { tx: tx, events: events, files: files, service: service };
};

describe('ReportService access rules', () => {
	it('lets the reporter read their own report', async () => {
		const { tx, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await expect(
			service.getReport('r1', { id: 'owner', privileged: false }),
		).resolves.toMatchObject({
			id: 'r1',
		});
	});

	it('hides other users reports as 404', async () => {
		const { tx, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await expect(
			service.getReport('r1', { id: 'someone-else', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('lets privileged staff read any report', async () => {
		const { tx, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await expect(service.getReport('r1', { id: 'mod', privileged: true })).resolves.toBeDefined();
	});

	it('forces non-privileged listings to the requester, ignoring reportedBy', async () => {
		const { tx, service } = setup();
		await service.listReports({ reportedBy: 'victim' }, { id: 'me', privileged: false });
		expect(whereOf(tx.report.findMany)).toMatchObject({ reportedBy: 'me' });
	});

	it('honours the reportedBy filter for privileged staff', async () => {
		const { tx, service } = setup();
		await service.listReports({ reportedBy: 'victim' }, { id: 'mod', privileged: true });
		expect(whereOf(tx.report.findMany)).toMatchObject({ reportedBy: 'victim' });
	});

	it('refuses to attach files to someone elses report', async () => {
		const { tx, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await expect(
			service.addFileToReport('r1', 'f1', { id: 'someone-else', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.reportFile.upsert).not.toHaveBeenCalled();
	});

	it('publishes status-changed only when the status actually changes', async () => {
		const { tx, events, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		tx.report.update.mockResolvedValue(report({ status: 'resolved' }));
		await service.updateReport({ id: 'r1', status: 'resolved', resolvedBy: 'mod' });
		expect(firstArg(events.reportStatusChanged)).toMatchObject({
			reportId: 'r1',
			reportedBy: 'owner',
			status: 'resolved',
		});

		events.reportStatusChanged.mockClear();
		tx.report.update.mockResolvedValue(report());
		await service.updateReport({ id: 'r1', adminResponse: 'noted' });
		expect(events.reportStatusChanged).not.toHaveBeenCalled();
	});

	it('returns 404 when removing a file that is not attached', async () => {
		const { tx, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		tx.reportFile.deleteMany.mockResolvedValue({ count: 0 });
		await expect(
			service.removeFileFromReport('r1', 'f1', { id: 'owner', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('ReportService file ownership', () => {
	const newReport = { reportedBy: 'owner', type: 'bug', title: 't', description: 'd' };

	it('report files reject foreign files on create (403)', async () => {
		const { tx, files, service } = setup();
		files.assertOwnedBy.mockRejectedValue(new ForbiddenException('foreign'));
		await expect(
			service.createReport({ ...newReport, fileIds: ['theirs'] }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'owner');
		expect(tx.report.create).not.toHaveBeenCalled();
	});

	it('creates a report with the reporter own files', async () => {
		const { tx, files, service } = setup();
		await service.createReport({ ...newReport, fileIds: ['mine', 'mine'] });
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['mine'], 'owner');
		expect(tx.report.create).toHaveBeenCalledTimes(1);
	});

	it('report files reject attaching a foreign file (403)', async () => {
		const { tx, files, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		files.assertOwnedBy.mockRejectedValue(new ForbiddenException('foreign'));
		await expect(
			service.addFileToReport('r1', 'theirs', { id: 'owner', privileged: false }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'owner');
		expect(tx.reportFile.upsert).not.toHaveBeenCalled();
	});

	it('still checks ownership for privileged staff unless they may attach any file', async () => {
		const { tx, files, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await service.addFileToReport('r1', 'theirs', { id: 'mod', privileged: true });
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'mod');

		files.assertOwnedBy.mockClear();
		await service.addFileToReport('r1', 'theirs', { id: 'admin', privileged: true }, true);
		expect(files.assertOwnedBy).not.toHaveBeenCalled();
		expect(tx.reportFile.upsert).toHaveBeenCalledTimes(2);
	});
});
