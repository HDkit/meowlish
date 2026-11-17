import { ReportCreatedHandler } from '../../../../app/events/handlers/report-created.handler';
import { reportStatusText } from '../../../../app/events/handlers/report-status-changed.handler';
import { of, throwError } from 'rxjs';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('nestjs-cls', () => ({ UseCls: () => () => undefined }));

const event = (payload: object) => ({
	id: 'evt-1',
	type: 'resource.report.created',
	payload: payload,
});
const report = {
	reportId: 'r1',
	reportedBy: 'student-1',
	type: 'content',
	title: 'Sai đáp án câu 3',
	targetType: 'exam',
	targetId: 'e1',
};

const setup = (
	opts: { admins?: string[]; disabled?: string[]; claimed?: boolean; authDown?: boolean } = {},
) => {
	const authService = {
		findIdentityIdsByRole: jest.fn(() =>
			opts.authDown ?
				throwError(() => new Error('UNAVAILABLE'))
			:	of({ ids: opts.admins ?? ['admin-1', 'admin-2'] }),
		),
	};
	const notifications = {
		createNotification: jest.fn((n: object) => Promise.resolve(n)),
		push: jest.fn(),
	};
	const preferences = {
		isEnabled: jest.fn((id: string) => Promise.resolve(!(opts.disabled ?? []).includes(id))),
	};
	const inbox = { claim: jest.fn().mockResolvedValue(opts.claimed ?? true) };
	const handler = new ReportCreatedHandler(
		{ getService: () => authService } as never,
		notifications as never,
		preferences as never,
		inbox as never,
	);
	handler.onModuleInit();
	return { handler: handler, authService: authService, notifications: notifications };
};

describe('ReportCreatedHandler', () => {
	it('notifies every admin about a new report', async () => {
		const { handler, authService, notifications } = setup();
		await handler.handle(event(report));
		expect(authService.findIdentityIdsByRole).toHaveBeenCalledWith({ role: 'admin' });
		expect(notifications.createNotification).toHaveBeenCalledTimes(2);
		expect(notifications.createNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientId: 'admin-1',
				type: 'report',
				title: 'Có báo cáo mới cần xử lý',
			}),
		);
	});

	it('skips the reporting admin and admins who turned report notifications off', async () => {
		const { handler, notifications } = setup({
			admins: ['admin-1', 'student-1', 'admin-3'],
			disabled: ['admin-3'],
		});
		await handler.handle(event({ ...report, reportedBy: 'student-1' }));
		const recipients = (
			notifications.createNotification.mock.calls as [{ recipientId: string }][]
		).map(([n]) => n.recipientId);
		expect(recipients).toEqual(['admin-1']);
	});

	it('does nothing for a redelivered event', async () => {
		const { handler, notifications } = setup({ claimed: false });
		await handler.handle(event(report));
		expect(notifications.createNotification).not.toHaveBeenCalled();
		expect(notifications.push).toHaveBeenCalledWith([]);
	});

	it('pushes every stored notification once, after storing all of them', async () => {
		const { handler, notifications } = setup();
		await handler.handle(event(report));
		expect(notifications.push).toHaveBeenCalledTimes(1);
		const [pushed] = notifications.push.mock.calls[0] as [{ recipientId: string }[]];
		expect(pushed.map(n => n.recipientId)).toEqual(['admin-1', 'admin-2']);
		expect(notifications.push.mock.invocationCallOrder[0]).toBeGreaterThan(
			Math.max(...notifications.createNotification.mock.invocationCallOrder),
		);
	});

	it('pushes nothing when a later insert fails (the transaction rolls back)', async () => {
		const { handler, notifications } = setup();
		notifications.createNotification
			.mockImplementationOnce((n: object) => Promise.resolve(n))
			.mockImplementationOnce(() => Promise.reject(new Error('insert failed')));
		await expect(handler.handle(event(report))).rejects.toThrow('insert failed');
		expect(notifications.push).not.toHaveBeenCalled();
	});

	it('fails (so the message is retried) when auth is unreachable', async () => {
		const { handler } = setup({ authDown: true });
		await expect(handler.handle(event(report))).rejects.toThrow('UNAVAILABLE');
	});
});

describe('reportStatusText', () => {
	it('reads naturally in Vietnamese and falls back to the raw status', () => {
		expect(reportStatusText('resolved')).toBe('đã được giải quyết');
		expect(reportStatusText('REJECTED')).toBe('đã bị từ chối');
		expect(reportStatusText('escalated')).toBe('chuyển sang trạng thái "escalated"');
	});
});
