import { type ResourceEventsPublisher } from '../events/resource-events.publisher';
import { ReportService } from './report.service';
import { NotFoundException } from '@nestjs/common';

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

const setup = () => {
	const tx = {
		report: {
			findUnique: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			update: jest.fn(),
			deleteMany: jest.fn(),
		},
		reportFile: { upsert: jest.fn(), deleteMany: jest.fn() },
	};
	const events = { reportStatusChanged: jest.fn() };
	const service = new ReportService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
	);
	return { tx: tx, events: events, service: service };
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
