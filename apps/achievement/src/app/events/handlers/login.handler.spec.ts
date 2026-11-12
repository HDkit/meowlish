import { IBadgeManagerRepositoryToken } from '../../../domain/repositories/badge-manager.repository';
import { LoginHandler } from './login.handler';
import {
	ClsPluginTransactional,
	NoOpTransactionalAdapter,
	TransactionHost,
} from '@nestjs-cls/transactional';
import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';
import { InboxService, createEnvelope } from '@server/messaging';
import { ClsModule } from 'nestjs-cls';

// Exercises the real @UseCls/@Transactional decorators: golevelup calls handlers outside any
// CLS context, so this calls `handle` directly, like the RabbitMQ module does.
describe('LoginHandler', () => {
	let moduleRef: TestingModule;
	let handler: LoginHandler;
	let txHost: TransactionHost;
	const manager = { updateProgress: jest.fn() };
	const repo = {
		getLoginBadgeManager: jest.fn().mockResolvedValue(manager),
		saveLoginBadgeManager: jest.fn().mockResolvedValue(undefined),
	};
	const claimed = new Set<string>();
	const inbox = {
		claim: jest.fn((id: string | undefined, consumer: string) => {
			// The real InboxService throws outside a transaction; mirror that here.
			if (!txHost.isTransactionActive()) throw new Error('claim outside a transaction');
			if (id === undefined) return Promise.resolve(true);
			const key = `${id}:${consumer}`;
			if (claimed.has(key)) return Promise.resolve(false);
			claimed.add(key);
			return Promise.resolve(true);
		}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		claimed.clear();
		moduleRef = await Test.createTestingModule({
			imports: [
				ClsModule.forRoot({
					global: true,
					plugins: [
						new ClsPluginTransactional({
							adapter: new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }),
						}),
					],
				}),
			],
			providers: [
				LoginHandler,
				{ provide: IBadgeManagerRepositoryToken, useValue: repo },
				{ provide: InboxService, useValue: inbox },
				// Resolved for the handler's @UseFilters(GlobalRmqExceptionFilter).
				{ provide: AppLoggerService, useValue: { error: jest.fn() } },
			],
		}).compile();
		await moduleRef.init();
		handler = moduleRef.get(LoginHandler);
		txHost = moduleRef.get(TransactionHost);
	});

	afterEach(async () => {
		await moduleRef.close();
	});

	const envelope = createEnvelope('auth.user.login', {
		uid: 'u1',
		date: '2026-11-12T08:00:00.000Z',
	});

	it('processes an envelope once even when delivered twice', async () => {
		await handler.handle(envelope);
		await handler.handle(envelope);

		expect(inbox.claim).toHaveBeenCalledTimes(2);
		expect(inbox.claim).toHaveBeenCalledWith(envelope.id, 'achievement.events.user.login');
		expect(repo.getLoginBadgeManager).toHaveBeenCalledTimes(1);
		expect(manager.updateProgress).toHaveBeenCalledTimes(1);
		expect(manager.updateProgress).toHaveBeenCalledWith(new Date('2026-11-12T08:00:00.000Z'));
		expect(repo.saveLoginBadgeManager).toHaveBeenCalledTimes(1);
	});

	it('runs the badge update inside the transaction', async () => {
		let activeDuringSave = false;
		repo.saveLoginBadgeManager.mockImplementationOnce(() => {
			activeDuringSave = txHost.isTransactionActive();
			return Promise.resolve();
		});
		await handler.handle(envelope);
		expect(activeDuringSave).toBe(true);
	});

	it('processes a legacy bare payload without inbox dedup', async () => {
		const legacy = { uid: 'u1', date: '2026-11-12T08:00:00.000Z' };
		await handler.handle(legacy);
		await handler.handle(legacy);

		expect(inbox.claim).toHaveBeenCalledWith(undefined, 'achievement.events.user.login');
		expect(repo.saveLoginBadgeManager).toHaveBeenCalledTimes(2);
	});

	it('throws on an invalid payload so the message dead-letters', async () => {
		await expect(
			handler.handle(createEnvelope('auth.user.login', { uid: 42 })),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repo.saveLoginBadgeManager).not.toHaveBeenCalled();
	});

	it('propagates repository errors instead of swallowing them', async () => {
		repo.saveLoginBadgeManager.mockRejectedValueOnce(new Error('P2025'));
		await expect(handler.handle(envelope)).rejects.toThrow('P2025');
	});
});
