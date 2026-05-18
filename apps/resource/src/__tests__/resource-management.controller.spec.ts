import { BlogController } from '../presentation/controllers/blog.controller';
import { FlashcardController } from '../presentation/controllers/flashcard.controller';
import { FlashcardListController } from '../presentation/controllers/flashcard-list.controller';
import { ReportController } from '../presentation/controllers/report.controller';
import { BlogService } from '../app/services/blog.service';
import { FlashcardService } from '../app/services/flashcard.service';
import { FlashcardListService } from '../app/services/flashcard-list.service';
import { ReportService } from '../app/services/report.service';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('ResourceManagementController', () => {
	let blogController: BlogController;
	let flashcardController: FlashcardController;
	let flashcardListController: FlashcardListController;
	let reportController: ReportController;

	const mockBlogService = {
		createBlog: jest.fn(),
		getBlog: jest.fn(),
		updateBlog: jest.fn(),
		deleteBlog: jest.fn(),
		listBlogs: jest.fn(),
	};

	const mockFlashcardService = {
		createFlashCard: jest.fn(),
		getFlashCard: jest.fn(),
		updateFlashCard: jest.fn(),
		deleteFlashCard: jest.fn(),
		listFlashCards: jest.fn(),
	};

	const mockFlashcardListService = {
		createFlashCardList: jest.fn(),
		getFlashCardList: jest.fn(),
		updateFlashCardList: jest.fn(),
		deleteFlashCardList: jest.fn(),
		listFlashCardLists: jest.fn(),
		addCardToList: jest.fn(),
		removeCardFromList: jest.fn(),
		listCardsInList: jest.fn(),
	};

	const mockReportService = {
		createReport: jest.fn(),
		getReport: jest.fn(),
		updateReport: jest.fn(),
		deleteReport: jest.fn(),
		listReports: jest.fn(),
		addFileToReport: jest.fn(),
		removeFileFromReport: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			controllers: [
				BlogController,
				FlashcardController,
				FlashcardListController,
				ReportController,
			],
			providers: [
				{ provide: BlogService, useValue: mockBlogService },
				{ provide: FlashcardService, useValue: mockFlashcardService },
				{ provide: FlashcardListService, useValue: mockFlashcardListService },
				{ provide: ReportService, useValue: mockReportService },
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

		blogController = module.get(BlogController);
		flashcardController = module.get(FlashcardController);
		flashcardListController = module.get(FlashcardListController);
		reportController = module.get(ReportController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('BlogController', () => {
		it('createBlog executes command and returns blog (ECP: valid input)', async () => {
			const mockResponse = {
				id: 'blog-1',
				title: 'Test Blog',
				content: 'Content',
				authorId: 'user-1',
				tags: ['tech'],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockBlogService.createBlog.mockResolvedValue(mockResponse);

			const result = await blogController.createBlog({
				title: 'Test Blog',
				content: 'Content',
				authorId: 'user-1',
				tags: ['tech'],
			});

			expect(result).toEqual(mockResponse);
			expect(mockBlogService.createBlog).toHaveBeenCalled();
		});

		it('getBlog returns blog by id', async () => {
			const mockResponse = {
				id: 'blog-1',
				title: 'Test Blog',
				content: 'Content',
				authorId: 'user-1',
				tags: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockBlogService.getBlog.mockResolvedValue(mockResponse);

			const result = await blogController.getBlog({ id: 'blog-1' });

			expect(result).toEqual(mockResponse);
			expect(mockBlogService.getBlog).toHaveBeenCalledWith('blog-1');
		});

		it('updateBlog executes partial update (Control Flow: optional fields)', async () => {
			const mockResponse = {
				id: 'blog-1',
				title: 'Updated Title',
				content: 'Content',
				authorId: 'user-1',
				tags: ['tech'],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockBlogService.updateBlog.mockResolvedValue(mockResponse);

			const result = await blogController.updateBlog({
				id: 'blog-1',
				title: 'Updated Title',
				tags: [],
			});

			expect(result).toEqual(mockResponse);
			expect(mockBlogService.updateBlog).toHaveBeenCalled();
		});

		it('deleteBlog executes command', async () => {
			mockBlogService.deleteBlog.mockResolvedValue(undefined);

			await blogController.deleteBlog({ id: 'blog-1' });

			expect(mockBlogService.deleteBlog).toHaveBeenCalledWith('blog-1');
		});
	});

	describe('FlashcardController', () => {
		it('createFlashCard executes command and returns card (ECP: valid with all fields)', async () => {
			const mockResponse = {
				id: 'card-1',
				word: 'hello',
				definition: 'a greeting',
				image: 'img.png',
				partOfSpeech: 'interjection',
				pronunciation: 'hə-lō',
				examples: ['Hello world'],
				notes: 'common word',
				authorId: 'user-1',
				tags: ['greeting'],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockFlashcardService.createFlashCard.mockResolvedValue(mockResponse);

			const result = await flashcardController.createFlashCard({
				word: 'hello',
				definition: 'a greeting',
				image: 'img.png',
				partOfSpeech: 'interjection',
				pronunciation: 'hə-lō',
				examples: ['Hello world'],
				notes: 'common word',
				authorId: 'user-1',
				tags: ['greeting'],
				listId: 'list-1',
			});

			expect(result).toEqual(mockResponse);
			expect(mockFlashcardService.createFlashCard).toHaveBeenCalled();
		});

		it('getFlashCard returns card by id', async () => {
			const mockResponse = {
				id: 'card-1',
				word: 'hello',
				definition: 'a greeting',
				examples: [],
				authorId: 'user-1',
				tags: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockFlashcardService.getFlashCard.mockResolvedValue(mockResponse);

			const result = await flashcardController.getFlashCard({ id: 'card-1' });

			expect(result).toEqual(mockResponse);
			expect(mockFlashcardService.getFlashCard).toHaveBeenCalledWith('card-1');
		});

		it('updateFlashCard executes partial update (Control Flow: null optional fields)', async () => {
			const mockResponse = {
				id: 'card-1',
				word: 'updated',
				definition: 'updated def',
				examples: [],
				authorId: 'user-1',
				tags: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockFlashcardService.updateFlashCard.mockResolvedValue(mockResponse);

			const result = await flashcardController.updateFlashCard({
				id: 'card-1',
				word: 'updated',
				definition: 'updated def',
				examples: [],
				tags: [],
			});

			expect(result).toEqual(mockResponse);
			expect(mockFlashcardService.updateFlashCard).toHaveBeenCalled();
		});

		it('listFlashCards returns paginated list (BVA: page 1, limit 10)', async () => {
			const mockResponse = {
				flashCards: [
					{
						id: 'card-1',
						word: 'hello',
						definition: 'a greeting',
						examples: [],
						authorId: 'user-1',
						tags: [],
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				],
				totalCount: 1,
			};
			mockFlashcardService.listFlashCards.mockResolvedValue(mockResponse);

			const result = await flashcardController.listFlashCards({
				page: 1,
				limit: 10,
				tags: [],
			});

			expect(result.flashCards).toHaveLength(1);
			expect(result.totalCount).toBe(1);
			expect(mockFlashcardService.listFlashCards).toHaveBeenCalledWith({
				page: 1,
				limit: 10,
				tags: [],
			});
		});
	});

	describe('FlashcardListController', () => {
		it('createFlashCardList executes command (ECP: with isPublic default)', async () => {
			const mockResponse = {
				id: 'list-1',
				name: 'My List',
				description: '',
				authorId: 'user-1',
				isPublic: false,
				tags: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockFlashcardListService.createFlashCardList.mockResolvedValue(mockResponse);

			const result = await flashcardListController.createFlashCardList({
				name: 'My List',
				authorId: 'user-1',
				tags: [],
			});

			expect(result).toEqual(mockResponse);
			expect(mockFlashcardListService.createFlashCardList).toHaveBeenCalled();
		});

		it('addCardToList executes command', async () => {
			mockFlashcardListService.addCardToList.mockResolvedValue(undefined);

			await flashcardListController.addCardToList({
				listId: 'list-1',
				flashCardId: 'card-1',
			});

			expect(mockFlashcardListService.addCardToList).toHaveBeenCalled();
		});

		it('removeCardFromList executes command (this actually deletes card)', async () => {
			mockFlashcardListService.removeCardFromList.mockResolvedValue(undefined);

			await flashcardListController.removeCardFromList({
				listId: 'list-1',
				flashCardId: 'card-1',
			});

			expect(mockFlashcardListService.removeCardFromList).toHaveBeenCalled();
		});

		it('listCardsInList returns paginated cards', async () => {
			const mockResponse = {
				flashCards: [
					{
						id: 'card-1',
						word: 'hello',
						definition: 'a greeting',
						examples: [],
						authorId: 'user-1',
						tags: [],
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				],
				totalCount: 1,
			};
			mockFlashcardListService.listCardsInList.mockResolvedValue(mockResponse);

			const result = await flashcardListController.listCardsInList({
				listId: 'list-1',
			});

			expect(result.flashCards).toHaveLength(1);
			expect(mockFlashcardListService.listCardsInList).toHaveBeenCalled();
		});
	});

	describe('ReportController', () => {
		it('createReport executes command with fileIds (ECP: valid with files)', async () => {
			const mockResponse = {
				id: 'report-1',
				reportedBy: 'user-1',
				type: 'spam',
				status: 'pending',
				title: 'Spam report',
				description: 'This is spam',
				fileIds: ['file-1', 'file-2'],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockReportService.createReport.mockResolvedValue(mockResponse);

			const result = await reportController.createReport({
				reportedBy: 'user-1',
				type: 'spam',
				title: 'Spam report',
				description: 'This is spam',
				fileIds: ['file-1', 'file-2'],
			});

			expect(result).toEqual(mockResponse);
			expect(mockReportService.createReport).toHaveBeenCalled();
		});

		it('updateReport executes status update (Decision Table: different status transitions)', async () => {
			const resolvedResponse = {
				id: 'report-1',
				reportedBy: 'user-1',
				type: 'spam',
				status: 'resolved',
				title: 'Spam report',
				description: 'This is spam',
				resolvedBy: 'admin-1',
				adminResponse: 'Reviewed and resolved',
				fileIds: [],
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};
			mockReportService.updateReport.mockResolvedValue(resolvedResponse);

			const result = await reportController.updateReport({
				id: 'report-1',
				status: 'resolved',
				resolvedBy: 'admin-1',
				adminResponse: 'Reviewed and resolved',
			});

			expect(result.status).toBe('resolved');
			expect(result.resolvedBy).toBe('admin-1');
			expect(mockReportService.updateReport).toHaveBeenCalled();

			const rejectedResponse = {
				...resolvedResponse,
				status: 'rejected',
				adminResponse: 'No evidence found',
			};
			mockReportService.updateReport.mockResolvedValue(rejectedResponse);

			const rejectedResult = await reportController.updateReport({
				id: 'report-1',
				status: 'rejected',
				resolvedBy: 'admin-1',
				adminResponse: 'No evidence found',
			});

			expect(rejectedResult.status).toBe('rejected');
			expect(rejectedResult.adminResponse).toBe('No evidence found');
		});

		it('listReports filters by type and status (ECP: valid filter combinations)', async () => {
			const mockResponse = {
				reports: [
					{
						id: 'report-1',
						reportedBy: 'user-1',
						type: 'spam',
						status: 'pending',
						title: 'Spam report',
						description: 'This is spam',
						fileIds: [],
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				],
				totalCount: 1,
			};
			mockReportService.listReports.mockResolvedValue(mockResponse);

			const result = await reportController.listReports({
				type: 'spam',
				status: 'pending',
			});

			expect(result.reports).toHaveLength(1);
			expect(result.totalCount).toBe(1);
			expect(mockReportService.listReports).toHaveBeenCalledWith({
				type: 'spam',
				status: 'pending',
			});
		});
	});
});
