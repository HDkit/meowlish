import { ResourceGatewayModule } from '../resource-gateway/resource.router.module';
import { RESOURCE_CLIENT } from '../resource-gateway/constants/resource';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector, RouterModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of } from 'rxjs';
import request from 'supertest';
import { Role, Permission } from '@server/typing';

const mockBlogService: Record<string, jest.Mock> = {
  createBlog: jest.fn(),
  getBlog: jest.fn(),
  updateBlog: jest.fn(),
  deleteBlog: jest.fn(),
  listBlogs: jest.fn(),
};

const mockFlashCardService: Record<string, jest.Mock> = {
  createFlashCard: jest.fn(),
  getFlashCard: jest.fn(),
  updateFlashCard: jest.fn(),
  deleteFlashCard: jest.fn(),
  listFlashCards: jest.fn(),
};

const mockFlashCardListService: Record<string, jest.Mock> = {
  createFlashCardList: jest.fn(),
  getFlashCardList: jest.fn(),
  updateFlashCardList: jest.fn(),
  deleteFlashCardList: jest.fn(),
  listFlashCardLists: jest.fn(),
  addCardToList: jest.fn(),
  removeCardFromList: jest.fn(),
  listCardsInList: jest.fn(),
};

const mockReportService: Record<string, jest.Mock> = {
  createReport: jest.fn(),
  getReport: jest.fn(),
  updateReport: jest.fn(),
  deleteReport: jest.fn(),
  listReports: jest.fn(),
  addFileToReport: jest.fn(),
  removeFileFromReport: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn((name: string) => {
    if (name.includes('Blog')) return mockBlogService;
    if (name.includes('FlashCard') && name.includes('List')) return mockFlashCardListService;
    if (name.includes('FlashCard')) return mockFlashCardService;
    if (name.includes('Report')) return mockReportService;
    return {};
  }),
};

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

function mockGuard(guard: unknown, canActivate: boolean, user?: Record<string, unknown>) {
  return {
    canActivate: (context: import('@nestjs/common').ExecutionContext) => {
      if (user) {
        const req = context.switchToHttp().getRequest();
        req.user = { ...req.user, ...user };
      }
      return canActivate;
    },
  };
}

describe('Resource (4.11)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { resource: { port: 50056, host: 'localhost' } } })],
        }),
        ResourceGatewayModule,
        RouterModule.register([
          {
            path: '/resources',
            module: ResourceGatewayModule,
          },
        ]),
      ],
      providers: [
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'user-1', roles: [Role.Mod], permissions: [Permission.EXAM_APPROVE] };
              return true;
            },
          },
        },
      ],
    })
      .overrideProvider(RESOURCE_CLIENT)
      .useValue(mockGrpcClient)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard(RolesGuard, true))
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard(PermissionsGuard, true))
      .overrideGuard(ResourceAccessGuard)
      .useValue(mockGuard(ResourceAccessGuard, true))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.11.1 Blogs', () => {
    it('POST /resources/blogs creates a blog', async () => {
      mockBlogService.createBlog.mockReturnValue(of({ id: 'blog-1', title: 'My Post', content: 'Hello', authorId: 'user-1', tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .post('/resources/blogs')
        .send({ title: 'My Post', content: 'Hello' })
        .expect(201);

      expect(res.body.id).toBe('blog-1');
      expect(mockBlogService.createBlog).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'user-1' }),
      );
    });

    it('POST /resources/blogs validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/resources/blogs')
        .send({ title: 'No content' })
        .expect(400);
    });

    it('POST /resources/blogs accepts tags', async () => {
      mockBlogService.createBlog.mockReturnValue(of({ id: 'blog-2', title: 'Tagged', content: 'With tags', authorId: 'user-1', tags: ['english', 'grammar'], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .post('/resources/blogs')
        .send({ title: 'Tagged', content: 'With tags', tags: ['english', 'grammar'] })
        .expect(201);

      expect(mockBlogService.createBlog).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['english', 'grammar'] }),
      );
    });

    it('GET /resources/blogs/:id returns a blog', async () => {
      mockBlogService.getBlog.mockReturnValue(of({ id: 'blog-1', title: 'My Post', content: 'Hello', authorId: 'user-1', tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .get('/resources/blogs/blog-1')
        .expect(200);

      expect(res.body.id).toBe('blog-1');
    });

    it('PATCH /resources/blogs/:id updates a blog', async () => {
      mockBlogService.updateBlog.mockReturnValue(of({ id: 'blog-1', title: 'Updated', content: 'New content', authorId: 'user-1', tags: [], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .patch('/resources/blogs/blog-1')
        .send({ title: 'Updated' })
        .expect(200);

      expect(mockBlogService.updateBlog).toHaveBeenCalled();
    });

    it('DELETE /resources/blogs/:id deletes a blog', async () => {
      mockBlogService.deleteBlog.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/blogs/blog-1')
        .expect(200);

      expect(mockBlogService.deleteBlog).toHaveBeenCalledWith({ id: 'blog-1' });
    });

    it('GET /resources/blogs lists blogs with pagination', async () => {
      mockBlogService.listBlogs.mockReturnValue(of({ blogs: [{ id: 'blog-1' }], totalCount: 1 }));

      const res = await request(app.getHttpServer())
        .get('/resources/blogs')
        .expect(200);

      expect(res.body.blogs).toHaveLength(1);
    });

    it('GET /resources/blogs supports query filters', async () => {
      mockBlogService.listBlogs.mockReturnValue(of({ blogs: [], totalCount: 0 }));

      await request(app.getHttpServer())
        .get('/resources/blogs?tags=english&tags=grammar&authorId=user-1&page=1&limit=20')
        .expect(200);

      expect(mockBlogService.listBlogs).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['english', 'grammar'], authorId: 'user-1', page: 1, limit: 20 }),
      );
    });
  });

  describe('4.11.2 Flash Cards', () => {
    it('POST /resources/flash-cards creates a flash card', async () => {
      mockFlashCardService.createFlashCard.mockReturnValue(of({ id: 'fc-1', word: 'hello', definition: 'a greeting', authorId: 'user-1', examples: [], tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .post('/resources/flash-cards')
        .send({ word: 'hello', definition: 'a greeting' })
        .expect(201);

      expect(res.body.id).toBe('fc-1');
    });

    it('POST /resources/flash-cards validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/resources/flash-cards')
        .send({ word: 'hello' })
        .expect(400);
    });

    it('POST /resources/flash-cards accepts all optional fields', async () => {
      mockFlashCardService.createFlashCard.mockReturnValue(of({ id: 'fc-2', word: 'bonjour', definition: 'hello', authorId: 'user-1', examples: ['Bonjour!'], tags: ['french'], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .post('/resources/flash-cards')
        .send({
          word: 'bonjour',
          definition: 'hello',
          image: 'https://example.com/bonjour.jpg',
          partOfSpeech: 'interjection',
          pronunciation: 'bohn-zhoor',
          examples: ['Bonjour!'],
          notes: 'Common greeting',
          tags: ['french'],
          listId: 'list-1',
        })
        .expect(201);

      expect(mockFlashCardService.createFlashCard).toHaveBeenCalledWith(
        expect.objectContaining({ word: 'bonjour', listId: 'list-1' }),
      );
    });

    it('GET /resources/flash-cards/:id returns a flash card', async () => {
      mockFlashCardService.getFlashCard.mockReturnValue(of({ id: 'fc-1', word: 'hello', definition: 'a greeting', authorId: 'user-1', examples: [], tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .get('/resources/flash-cards/fc-1')
        .expect(200);

      expect(res.body.word).toBe('hello');
    });

    it('PATCH /resources/flash-cards/:id updates a flash card', async () => {
      mockFlashCardService.updateFlashCard.mockReturnValue(of({ id: 'fc-1', word: 'hola', definition: 'hello', authorId: 'user-1', examples: [], tags: [], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .patch('/resources/flash-cards/fc-1')
        .send({ word: 'hola' })
        .expect(200);

      expect(mockFlashCardService.updateFlashCard).toHaveBeenCalled();
    });

    it('DELETE /resources/flash-cards/:id deletes a flash card', async () => {
      mockFlashCardService.deleteFlashCard.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/flash-cards/fc-1')
        .expect(200);

      expect(mockFlashCardService.deleteFlashCard).toHaveBeenCalledWith({ id: 'fc-1' });
    });

    it('GET /resources/flash-cards lists flash cards', async () => {
      mockFlashCardService.listFlashCards.mockReturnValue(of({ flashCards: [{ id: 'fc-1' }], totalCount: 1 }));

      const res = await request(app.getHttpServer())
        .get('/resources/flash-cards')
        .expect(200);

      expect(res.body.flashCards).toHaveLength(1);
    });
  });

  describe('4.11.3 Flash Card Lists', () => {
    it('POST /resources/flash-card-lists creates a list', async () => {
      mockFlashCardListService.createFlashCardList.mockReturnValue(of({ id: 'list-1', name: 'French Vocab', authorId: 'user-1', isPublic: false, tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .post('/resources/flash-card-lists')
        .send({ name: 'French Vocab' })
        .expect(201);

      expect(res.body.id).toBe('list-1');
    });

    it('POST /resources/flash-card-lists validates required name', async () => {
      await request(app.getHttpServer())
        .post('/resources/flash-card-lists')
        .send({})
        .expect(400);
    });

    it('GET /resources/flash-card-lists/:id returns list detail', async () => {
      mockFlashCardListService.getFlashCardList.mockReturnValue(of({ id: 'list-1', name: 'French Vocab', flashCards: [], totalCards: 0, authorId: 'user-1', isPublic: false, tags: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .get('/resources/flash-card-lists/list-1')
        .expect(200);

      expect(res.body.name).toBe('French Vocab');
    });

    it('PATCH /resources/flash-card-lists/:id updates a list', async () => {
      mockFlashCardListService.updateFlashCardList.mockReturnValue(of({ id: 'list-1', name: 'Updated', authorId: 'user-1', isPublic: true, tags: [], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .patch('/resources/flash-card-lists/list-1')
        .send({ name: 'Updated', isPublic: true })
        .expect(200);

      expect(mockFlashCardListService.updateFlashCardList).toHaveBeenCalled();
    });

    it('DELETE /resources/flash-card-lists/:id deletes a list', async () => {
      mockFlashCardListService.deleteFlashCardList.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/flash-card-lists/list-1')
        .expect(200);

      expect(mockFlashCardListService.deleteFlashCardList).toHaveBeenCalledWith({ id: 'list-1' });
    });

    it('GET /resources/flash-card-lists lists with filters', async () => {
      mockFlashCardListService.listFlashCardLists.mockReturnValue(of({ lists: [], totalCount: 0 }));

      await request(app.getHttpServer())
        .get('/resources/flash-card-lists?isPublic=true&page=1&limit=10')
        .expect(200);

      expect(mockFlashCardListService.listFlashCardLists).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true, page: 1, limit: 10 }),
      );
    });

    it('POST /resources/flash-card-lists/:id/cards adds card to list', async () => {
      mockFlashCardListService.addCardToList.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/resources/flash-card-lists/list-1/cards')
        .send({ flashCardId: 'fc-1' })
        .expect(201);

      expect(mockFlashCardListService.addCardToList).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'list-1' }),
      );
    });

    it('DELETE /resources/flash-card-lists/:listId/cards/:cardId removes card from list', async () => {
      mockFlashCardListService.removeCardFromList.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/flash-card-lists/list-1/cards/fc-1')
        .expect(200);

      expect(mockFlashCardListService.removeCardFromList).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'list-1', flashCardId: 'fc-1' }),
      );
    });

    it('GET /resources/flash-card-lists/:id/cards lists cards in list', async () => {
      mockFlashCardListService.listCardsInList.mockReturnValue(of({ flashCards: [{ id: 'fc-1' }], totalCount: 1 }));

      const res = await request(app.getHttpServer())
        .get('/resources/flash-card-lists/list-1/cards')
        .expect(200);

      expect(res.body.flashCards).toHaveLength(1);
    });
  });

  describe('4.11.4 Reports', () => {
    it('POST /resources/reports creates a report', async () => {
      mockReportService.createReport.mockReturnValue(of({ id: 'report-1', type: 'spam', title: 'Spam Report', description: 'This is spam', reportedBy: 'user-1', status: 'OPEN', fileIds: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .post('/resources/reports')
        .send({ type: 'spam', title: 'Spam Report', description: 'This is spam' })
        .expect(201);

      expect(res.body.id).toBe('report-1');
    });

    it('POST /resources/reports validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/resources/reports')
        .send({ type: 'spam' })
        .expect(400);
    });

    it('POST /resources/reports uses req.user.sub as reportedBy', async () => {
      mockReportService.createReport.mockReturnValue(of({ id: 'report-2', type: 'bug', title: 'Bug', description: 'A bug', reportedBy: 'user-1', status: 'OPEN', fileIds: [], createdAt: new Date(), updatedAt: new Date() }));

      await request(app.getHttpServer())
        .post('/resources/reports')
        .send({ type: 'bug', title: 'Bug', description: 'A bug' })
        .expect(201);

      expect(mockReportService.createReport).toHaveBeenCalledWith(
        expect.objectContaining({ reportedBy: 'user-1' }),
      );
    });

    it('GET /resources/reports/:id returns a report', async () => {
      mockReportService.getReport.mockReturnValue(of({ id: 'report-1', type: 'spam', title: 'Spam', description: 'Spam content', reportedBy: 'user-2', status: 'OPEN', fileIds: [], createdAt: new Date(), updatedAt: new Date() }));

      const res = await request(app.getHttpServer())
        .get('/resources/reports/report-1')
        .expect(200);

      expect(res.body.id).toBe('report-1');
    });

    it('PATCH /resources/reports/:id updates a report', async () => {
      mockReportService.updateReport.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/resources/reports/report-1')
        .send({ status: 'RESOLVED', adminResponse: 'Handled' })
        .expect(200);

      expect(mockReportService.updateReport).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'report-1', status: 'RESOLVED' }),
      );
    });

    it('DELETE /resources/reports/:id deletes a report', async () => {
      mockReportService.deleteReport.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/reports/report-1')
        .expect(200);

      expect(mockReportService.deleteReport).toHaveBeenCalledWith({ id: 'report-1' });
    });

    it('GET /resources/reports lists with filters', async () => {
      mockReportService.listReports.mockReturnValue(of({ reports: [], totalCount: 0 }));

      await request(app.getHttpServer())
        .get('/resources/reports?type=spam&status=OPEN&page=1&limit=20')
        .expect(200);

      expect(mockReportService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'spam', status: 'OPEN', page: 1, limit: 20 }),
      );
    });

    it('POST /resources/reports/:id/files adds file to report', async () => {
      mockReportService.addFileToReport.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/resources/reports/report-1/files')
        .send({ fileId: 'file-1' })
        .expect(201);

      expect(mockReportService.addFileToReport).toHaveBeenCalledWith(
        expect.objectContaining({ reportId: 'report-1' }),
      );
    });

    it('DELETE /resources/reports/:reportId/files/:fileId removes file from report', async () => {
      mockReportService.removeFileFromReport.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/resources/reports/report-1/files/file-1')
        .expect(200);

      expect(mockReportService.removeFileFromReport).toHaveBeenCalledWith(
        expect.objectContaining({ reportId: 'report-1', fileId: 'file-1' }),
      );
    });
  });
});
