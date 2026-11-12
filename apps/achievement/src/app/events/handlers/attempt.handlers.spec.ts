import { IBadgeManagerRepositoryToken } from '../../../domain/repositories/badge-manager.repository';
import { AttemptScoredHandler } from './attempt-scored.handler';
import { AttemptSubmittedHandler } from './attempt-submitted.handler';
import { ClsPluginTransactional, NoOpTransactionalAdapter } from '@nestjs-cls/transactional';
import { Test } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';
import { InboxService, createEnvelope } from '@server/messaging';
import { ClsModule } from 'nestjs-cls';

class PrismaClientKnownRequestError extends Error {
	constructor(
		message: string,
		readonly code: string,
	) {
		super(message);
		this.name = 'PrismaClientKnownRequestError';
	}
}

const conflict = () => new PrismaClientKnownRequestError('stale version', 'P2025');

describe.each([
	{
		name: 'AttemptSubmittedHandler',
		handlerClass: AttemptSubmittedHandler,
		event: createEnvelope('exam.attempt.submitted', { attemptedBy: 'u1' }),
		get: 'getAttemptCounterBadgeManager',
		save: 'saveAttemptCounterBadgeManager',
	},
	{
		name: 'AttemptScoredHandler',
		handlerClass: AttemptScoredHandler,
		event: createEnvelope('exam.attempt.scored', {
			attemptedBy: 'u1',
			score: 1,
			totalPoints: 2,
		}),
		get: 'getAttemptScoreBadgeManager',
		save: 'saveAttemptScoreBadgeManager',
	},
])('$name version-conflict retry', ({ handlerClass, event, get, save }) => {
	const build = async () => {
		const manager = { updateProgress: jest.fn() };
		const repo = {
			[get]: jest.fn().mockResolvedValue(manager),
			[save]: jest.fn().mockResolvedValue(undefined),
		};
		const inbox = { claim: jest.fn().mockResolvedValue(true) };
		const moduleRef = await Test.createTestingModule({
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
				handlerClass,
				{ provide: IBadgeManagerRepositoryToken, useValue: repo },
				{ provide: InboxService, useValue: inbox },
				{ provide: AppLoggerService, useValue: { error: jest.fn() } },
			],
		}).compile();
		await moduleRef.init();
		const handler = moduleRef.get<{ handle(m: unknown): Promise<void> }>(handlerClass);
		return { handler: handler, repo: repo, inbox: inbox, moduleRef: moduleRef };
	};

	it('retries after one conflict and succeeds', async () => {
		const { handler, repo, inbox, moduleRef } = await build();
		repo[save].mockRejectedValueOnce(conflict());
		await expect(handler.handle(event)).resolves.toBeUndefined();
		expect(repo[save]).toHaveBeenCalledTimes(2);
		expect(inbox.claim).toHaveBeenCalledTimes(2);
		await moduleRef.close();
	});

	it('throws after 3 conflicts', async () => {
		const { handler, repo, moduleRef } = await build();
		repo[save].mockRejectedValue(conflict());
		await expect(handler.handle(event)).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
		expect(repo[save]).toHaveBeenCalledTimes(3);
		await moduleRef.close();
	});

	it('throws other errors immediately', async () => {
		const { handler, repo, moduleRef } = await build();
		repo[save].mockRejectedValue(new Error('boom'));
		await expect(handler.handle(event)).rejects.toThrow('boom');
		expect(repo[save]).toHaveBeenCalledTimes(1);
		await moduleRef.close();
	});
});
