import { type ResourceEventsPublisher } from '../../../app/events/resource-events.publisher';
import { ReportService } from '../../../app/services/report.service';
import { ReportStatus } from '../../../enums/report-status.enum';
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
		reportFile: {
			createMany: jest.fn().mockResolvedValue({ count: 1 }),
			deleteMany: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
		},
	};
	const events = {
		reportStatusChanged: jest.fn(),
		reportCreated: jest.fn(),
		fileAdded: jest.fn(),
		filesRemoved: jest.fn(),
	};
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
		expect(tx.reportFile.createMany).not.toHaveBeenCalled();
	});

	it('publishes status-changed only when the status actually changes', async () => {
		const { tx, events, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		tx.report.update.mockResolvedValue(report({ status: 'resolved' }));
		await service.updateReport({ id: 'r1', status: ReportStatus.Resolved, resolvedBy: 'mod' });
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

	it('keeps resolvedBy when an update changes neither status nor response', async () => {
		const { tx, service } = setup();
		const dataOf = (call: number) =>
			(tx.report.update.mock.calls as [{ data: { resolvedBy: string | null } }][])[call][0].data;
		tx.report.findUnique.mockResolvedValue(
			report({ status: 'resolved', resolvedBy: 'mod1', adminResponse: 'done' }),
		);
		tx.report.update.mockResolvedValue(report());

		await service.updateReport({
			id: 'r1',
			status: ReportStatus.Resolved,
			adminResponse: 'done',
			resolvedBy: 'mod2',
		});
		expect(dataOf(0).resolvedBy).toBe('mod1');

		await service.updateReport({ id: 'r1', adminResponse: 'more detail', resolvedBy: 'mod2' });
		expect(dataOf(1).resolvedBy).toBe('mod2');
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

	it('lets admins attach files they did not upload on create', async () => {
		const { tx, files, service } = setup();
		await service.createReport({ ...newReport, fileIds: ['theirs'], mayAttachAnyFile: true });
		expect(files.assertOwnedBy).not.toHaveBeenCalled();
		expect(tx.report.create).toHaveBeenCalledTimes(1);
	});

	it('asks file-service before the transaction opens', async () => {
		const { tx, files, service } = setup();
		const inTx = jest.spyOn(TransactionHost.getInstance(), 'withTransaction');
		await service.createReport({ ...newReport, fileIds: ['mine'] });
		expect(files.assertOwnedBy.mock.invocationCallOrder[0]).toBeLessThan(
			inTx.mock.invocationCallOrder[0],
		);
		expect(tx.report.create).toHaveBeenCalledTimes(1);
		inTx.mockRestore();
	});

	it('creates a report with the reporter own files', async () => {
		const { tx, files, service } = setup();
		await service.createReport({ ...newReport, fileIds: ['mine', 'mine'] });
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['mine'], 'owner');
		expect(tx.report.create).toHaveBeenCalledTimes(1);
	});

	it('announces a new report so admins get notified', async () => {
		const { tx, events, service } = setup();
		tx.report.create.mockResolvedValue({
			...report(),
			id: 'r1',
			reportedBy: 'owner',
			type: 'content',
			title: 'Sai đáp án',
			targetType: 'exam',
			targetId: 'e1',
		});
		await service.createReport({ ...newReport, fileIds: [] });
		expect(events.reportCreated).toHaveBeenCalledWith({
			reportId: 'r1',
			reportedBy: 'owner',
			type: 'content',
			title: 'Sai đáp án',
			targetType: 'exam',
			targetId: 'e1',
		});
	});

	it('report files reject attaching a foreign file (403)', async () => {
		const { tx, files, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		files.assertOwnedBy.mockRejectedValue(new ForbiddenException('foreign'));
		await expect(
			service.addFileToReport('r1', 'theirs', { id: 'owner', privileged: false }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'owner');
		expect(tx.reportFile.createMany).not.toHaveBeenCalled();
	});

	it('still checks ownership for privileged staff unless they may attach any file', async () => {
		const { tx, files, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await service.addFileToReport('r1', 'theirs', { id: 'mod', privileged: true });
		expect(files.assertOwnedBy).toHaveBeenCalledWith(['theirs'], 'mod');

		files.assertOwnedBy.mockClear();
		await service.addFileToReport('r1', 'theirs', { id: 'admin', privileged: true }, true);
		expect(files.assertOwnedBy).not.toHaveBeenCalled();
		expect(tx.reportFile.createMany).toHaveBeenCalledTimes(2);
	});
});

describe('ReportService file references (C20)', () => {
	const owner = { id: 'owner', privileged: false };

	it('adds a reference for each attachment of a new report', async () => {
		const { tx, events, service } = setup();
		tx.report.create.mockResolvedValue(report({ files: [{ fileId: 'f1' }, { fileId: 'f2' }] }));
		await service.createReport({
			reportedBy: 'owner',
			type: 'bug',
			title: 'Broken',
			description: 'desc',
			fileIds: ['f1', 'f2', 'f1'],
		});
		expect(events.fileAdded.mock.calls).toEqual([['f1'], ['f2']]);
	});

	it('adds a reference only when a file is newly attached', async () => {
		const { tx, events, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		await service.addFileToReport('r1', 'f1', owner, true);
		tx.reportFile.createMany.mockResolvedValueOnce({ count: 0 });
		await service.addFileToReport('r1', 'f1', owner, true);
		expect(events.fileAdded.mock.calls).toEqual([['f1']]);
	});

	it('releases references on detach and on report delete', async () => {
		const { tx, events, service } = setup();
		tx.report.findUnique.mockResolvedValue(report());
		tx.reportFile.deleteMany.mockResolvedValue({ count: 1 });
		await service.removeFileFromReport('r1', 'f1', owner);
		expect(events.filesRemoved).toHaveBeenLastCalledWith([{ id: 'f1', count: 1 }]);

		tx.reportFile.findMany.mockResolvedValue([{ fileId: 'f2' }, { fileId: 'f3' }]);
		tx.report.deleteMany.mockResolvedValue({ count: 1 });
		await service.deleteReport('r1');
		expect(events.filesRemoved).toHaveBeenLastCalledWith([
			{ id: 'f2', count: 1 },
			{ id: 'f3', count: 1 },
		]);
	});
});
