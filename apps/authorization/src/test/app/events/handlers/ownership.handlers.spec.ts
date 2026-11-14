import {
	ExamCreatedHandler,
	ExamDeletedHandler,
} from '../../../../app/events/handlers/exam-ownership.handler';
import {
	RoomCreatedHandler,
	RoomDeletedHandler,
} from '../../../../app/events/handlers/live-ownership.handler';
import {
	ResourceCreatedHandler,
	ResourceDeletedHandler,
} from '../../../../app/events/handlers/resource-ownership.handler';
import { IOwnershipRepositoryToken } from '../../../../domain/repositories/ownership.repository';
import { ClsPluginTransactional, NoOpTransactionalAdapter } from '@nestjs-cls/transactional';
import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';
import { InboxService, createEnvelope } from '@server/messaging';
import { ClsModule } from 'nestjs-cls';

// Calls `handle` directly, like the RabbitMQ module does, through the real @UseCls/@Transactional.
describe('ownership event handlers', () => {
	let moduleRef: TestingModule;
	const repo = {
		registerOwnership: jest.fn().mockResolvedValue(undefined),
		removeOwnership: jest.fn().mockResolvedValue(undefined),
	};
	const inbox = { claim: jest.fn().mockResolvedValue(true) };

	beforeEach(async () => {
		jest.clearAllMocks();
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
				ExamCreatedHandler,
				ExamDeletedHandler,
				RoomCreatedHandler,
				RoomDeletedHandler,
				ResourceCreatedHandler,
				ResourceDeletedHandler,
				{ provide: IOwnershipRepositoryToken, useValue: repo },
				{ provide: InboxService, useValue: inbox },
				{ provide: AppLoggerService, useValue: { debug: jest.fn(), error: jest.fn() } },
			],
		}).compile();
		await moduleRef.init();
	});

	afterEach(async () => {
		await moduleRef.close();
	});

	it.each([
		[ExamCreatedHandler, 'exam.exam.created', 'exam'],
		[RoomCreatedHandler, 'live.room.created', 'room'],
	] as const)('%p registers a valid owner', async (handlerClass, type, resourceType) => {
		await moduleRef
			.get(handlerClass)
			.handle(
				createEnvelope(type, { resourceType: resourceType, resourceId: 'r1', ownerId: 'u1' }),
			);
		expect(repo.registerOwnership).toHaveBeenCalledWith(resourceType, 'r1', 'u1');
	});

	it('registers the type carried by resource.resource.created', async () => {
		await moduleRef.get(ResourceCreatedHandler).handle(
			createEnvelope('resource.resource.created', {
				resourceType: 'blog',
				resourceId: 'b1',
				ownerId: 'u1',
			}),
		);
		expect(repo.registerOwnership).toHaveBeenCalledWith('blog', 'b1', 'u1');
	});

	it.each([
		[ExamDeletedHandler, 'exam.exam.deleted', 'exam'],
		[RoomDeletedHandler, 'live.room.deleted', 'room'],
	] as const)('%p removes ownership', async (handlerClass, type, resourceType) => {
		await moduleRef.get(handlerClass).handle(createEnvelope(type, { resourceId: 'r1' }));
		expect(repo.removeOwnership).toHaveBeenCalledWith(resourceType, 'r1');
	});

	it('removes the type carried by resource.resource.deleted', async () => {
		await moduleRef.get(ResourceDeletedHandler).handle(
			createEnvelope('resource.resource.deleted', {
				resourceType: 'flashcard',
				resourceId: 'f1',
			}),
		);
		expect(repo.removeOwnership).toHaveBeenCalledWith('flashcard', 'f1');
	});

	it.each([
		['created without an owner', ExamCreatedHandler, { resourceId: 'r1' }],
		['created with a numeric id', RoomCreatedHandler, { resourceId: 5, ownerId: 'u1' }],
		[
			'resource created without a type',
			ResourceCreatedHandler,
			{ resourceId: 'b1', ownerId: 'u1' },
		],
		['deleted without an id', ExamDeletedHandler, {}],
		['deleted with an empty id', RoomDeletedHandler, { resourceId: '' }],
		['resource deleted without a type', ResourceDeletedHandler, { resourceId: 'b1' }],
	] as const)(
		'rejects a malformed payload (%s) before the database',
		async (_n, handlerClass, payload) => {
			await expect(
				moduleRef.get(handlerClass).handle(createEnvelope('x.y.z', payload)),
			).rejects.toBeInstanceOf(BadRequestException);
			expect(repo.registerOwnership).not.toHaveBeenCalled();
			expect(repo.removeOwnership).not.toHaveBeenCalled();
		},
	);
});
