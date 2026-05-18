import { AuthorizationGrpcController } from '../app/services/authorization.grpc.controller';
import {
	ResourceCreatedHandler,
	ResourceDeletedHandler,
} from '../app/events/handlers/resource-ownership.handler';
import { ExamCreatedHandler } from '../app/events/handlers/exam-ownership.handler';
import { RoomCreatedHandler } from '../app/events/handlers/live-ownership.handler';
import {
	IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../domain/repositories/ownership.repository';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('AuthorizationController', () => {
	let controller: AuthorizationGrpcController;
	let resourceCreatedHandler: ResourceCreatedHandler;
	let examCreatedHandler: ExamCreatedHandler;
	let roomCreatedHandler: RoomCreatedHandler;

	const mockOwnershipRepository: jest.Mocked<IOwnershipRepository> = {
		checkOwnership: jest.fn(),
		registerOwnership: jest.fn(),
		removeOwnership: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			controllers: [AuthorizationGrpcController],
			providers: [
				{ provide: IOwnershipRepositoryToken, useValue: mockOwnershipRepository },
				ResourceCreatedHandler,
				ResourceDeletedHandler,
				ExamCreatedHandler,
				RoomCreatedHandler,
				{
					provide: 'winston',
					useValue: {
						info: jest.fn(),
						error: jest.fn(),
						warn: jest.fn(),
						debug: jest.fn(),
						verbose: jest.fn(),
					},
				},
				{
					provide: AppLoggerService,
					useFactory: () =>
						new AppLoggerService({
							info: jest.fn(),
							error: jest.fn(),
							warn: jest.fn(),
							debug: jest.fn(),
							verbose: jest.fn(),
						} as never),
				},
			],
		}).compile();

		controller = module.get(AuthorizationGrpcController);
		resourceCreatedHandler = module.get(ResourceCreatedHandler);
		examCreatedHandler = module.get(ExamCreatedHandler);
		roomCreatedHandler = module.get(RoomCreatedHandler);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('checkOwnership', () => {
		it('returns isOwner=true (ECP: valid ownership)', async () => {
			mockOwnershipRepository.checkOwnership.mockResolvedValue(true);

			const result = await controller.checkOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
				userId: 'user-1',
			});

			expect(result.isOwner).toBe(true);
			expect(mockOwnershipRepository.checkOwnership).toHaveBeenCalledWith(
				'blog',
				'blog-1',
				'user-1',
			);
		});

		it('returns isOwner=false (ECP: no ownership)', async () => {
			mockOwnershipRepository.checkOwnership.mockResolvedValue(false);

			const result = await controller.checkOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
				userId: 'user-2',
			});

			expect(result.isOwner).toBe(false);
		});
	});

	describe('registerOwnership', () => {
		it('executes command (Control Flow: create then check)', async () => {
			mockOwnershipRepository.registerOwnership.mockResolvedValue(undefined);
			mockOwnershipRepository.checkOwnership.mockResolvedValue(true);

			await controller.registerOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
				ownerId: 'user-1',
			});

			expect(mockOwnershipRepository.registerOwnership).toHaveBeenCalledWith(
				'blog',
				'blog-1',
				'user-1',
			);

			const checkResult = await controller.checkOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
				userId: 'user-1',
			});

			expect(checkResult.isOwner).toBe(true);
		});
	});

	describe('removeOwnership', () => {
		it('executes command (Control Flow: remove then check)', async () => {
			mockOwnershipRepository.removeOwnership.mockResolvedValue(undefined);
			mockOwnershipRepository.checkOwnership.mockResolvedValue(false);

			await controller.removeOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
			});

			expect(mockOwnershipRepository.removeOwnership).toHaveBeenCalledWith(
				'blog',
				'blog-1',
			);

			const checkResult = await controller.checkOwnership({
				resourceType: 'blog',
				resourceId: 'blog-1',
				userId: 'user-1',
			});

			expect(checkResult.isOwner).toBe(false);
		});
	});

	describe('Event handler integration', () => {
		it('processes events from different resource types (Decision Table: exam, room, blog)', async () => {
			mockOwnershipRepository.registerOwnership.mockResolvedValue(undefined);

			await resourceCreatedHandler.handle({
				resourceType: 'blog',
				resourceId: 'blog-1',
				ownerId: 'user-1',
			});
			expect(mockOwnershipRepository.registerOwnership).toHaveBeenCalledWith(
				'blog',
				'blog-1',
				'user-1',
			);

			jest.clearAllMocks();
			mockOwnershipRepository.registerOwnership.mockResolvedValue(undefined);

			await examCreatedHandler.handle({
				resourceType: 'exam',
				resourceId: 'exam-1',
				ownerId: 'user-2',
			});
			expect(mockOwnershipRepository.registerOwnership).toHaveBeenCalledWith(
				'exam',
				'exam-1',
				'user-2',
			);

			jest.clearAllMocks();
			mockOwnershipRepository.registerOwnership.mockResolvedValue(undefined);

			await roomCreatedHandler.handle({
				resourceType: 'room',
				resourceId: 'room-1',
				ownerId: 'user-3',
			});
			expect(mockOwnershipRepository.registerOwnership).toHaveBeenCalledWith(
				'room',
				'room-1',
				'user-3',
			);
		});
	});
});
