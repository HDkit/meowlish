import { ExamManagementGatewayController } from '../exam-gateway/exam-management.router.controller';
import { EXAM_CLIENT } from '../exam-gateway/constants/exam';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of } from 'rxjs';
import request from 'supertest';
import { Role, Permission } from '@server/typing';

const mockExamService: Record<string, jest.Mock> = {
  createExam: jest.fn(),
  updateExam: jest.fn(),
  deleteExam: jest.fn(),
  reviewExam: jest.fn(),
  createSection: jest.fn(),
  createQuestion: jest.fn(),
  updateSection: jest.fn(),
  updateQuestion: jest.fn(),
  deleteSection: jest.fn(),
  deleteQuestion: jest.fn(),
  moveSection: jest.fn(),
  moveQuestion: jest.fn(),
  findExams: jest.fn(),
  getExamDetails: jest.fn(),
  getSectionDetails: jest.fn(),
  getQuestionDetails: jest.fn(),
  getExamCounts: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockExamService),
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

function setReflectorValue(reflector: Reflector, key: string, value: unknown) {
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((k: unknown) => {
    if (k === key) return value;
    return undefined;
  });
}

describe('Exam Management (4.5)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let reflector: Reflector;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { exam: { port: 50051, host: 'localhost' } } })],
        }),
      ],
      controllers: [ExamManagementGatewayController],
      providers: [
        { provide: EXAM_CLIENT, useValue: mockGrpcClient },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'mod1', roles: [Role.Mod], permissions: [Permission.EXAM_APPROVE] };
              return true;
            },
          },
        },
      ],
    })
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
    reflector = moduleRef.get(Reflector);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.5.1 Create exam', () => {
    it('POST /management returns 201 + exam id', async () => {
      mockExamService.createExam.mockReturnValue(of({ id: 'exam-1' }));

      const res = await request(app.getHttpServer())
        .post('/management')
        .send({ title: 'Math Test', description: 'Algebra basics', duration: 60 })
        .expect(201);

      expect(res.body.id).toBe('exam-1');
    });

    it('POST /management validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/management')
        .send({ title: 'Incomplete' })
        .expect(400);
    });
  });

  describe('4.5.2 Create section', () => {
    it('POST /management/:id/sections returns 201', async () => {
      mockExamService.createSection.mockReturnValue(of({ id: 'sec-1' }));

      const res = await request(app.getHttpServer())
        .post('/management/exam-1/sections')
        .send({})
        .expect(201);

      expect(res.body.id).toBe('sec-1');
      expect(mockExamService.createSection).toHaveBeenCalledWith({ examId: 'exam-1' });
    });

    it('POST /management/sections/:id/sections creates nested', async () => {
      mockExamService.createSection.mockReturnValue(of({ id: 'child-sec' }));

      const res = await request(app.getHttpServer())
        .post('/management/sections/sec-1/sections')
        .send({ index: 1 })
        .expect(201);

      expect(res.body.id).toBe('child-sec');
    });
  });

  describe('4.5.3 Create question', () => {
    it('POST /management/sections/:id/questions returns 201', async () => {
      mockExamService.createQuestion.mockReturnValue(of({ id: 'q-1' }));

      const res = await request(app.getHttpServer())
        .post('/management/sections/sec-1/questions')
        .send({})
        .expect(201);

      expect(res.body.id).toBe('q-1');
    });
  });

  describe('4.5.4 Update exam', () => {
    it('PATCH /management/:id updates exam fields', async () => {
      mockExamService.updateExam.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/management/exam-1')
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(mockExamService.updateExam).toHaveBeenCalled();
    });

    it('updates exam description via gRPC', async () => {
      mockExamService.updateExam.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/management/exam-1')
        .send({ description: 'Updated desc', setDescriptionNull: false })
        .expect(200);

      expect(mockExamService.updateExam).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'exam-1', description: 'Updated desc' }),
      );
    });
  });

  describe('4.5.5 Review exam', () => {
    it('PATCH /management/:id/review with EXAM_APPROVE permission', async () => {
      mockExamService.reviewExam.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/management/exam-1/review')
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(mockExamService.reviewExam).toHaveBeenCalledWith({ id: 'exam-1', status: 'APPROVED' });
    });

    it('rejects invalid review status', async () => {
      await request(app.getHttpServer())
        .patch('/management/exam-1/review')
        .send({})
        .expect(400);
    });
  });

  describe('4.5.6 Delete exam', () => {
    it('DELETE /management/:id returns 200', async () => {
      mockExamService.deleteExam.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/management/exam-1')
        .expect(200);

      expect(mockExamService.deleteExam).toHaveBeenCalledWith({ id: 'exam-1' });
    });
  });

  describe('4.5.7 Find exams and counts', () => {
    it('GET /management/exams returns paginated results', async () => {
      const mockResult = { exams: [{ id: 'exam-1', title: 'Test' }], nextCursor: null, prevCursor: null };
      mockExamService.findExams.mockReturnValue(of(mockResult));

      const res = await request(app.getHttpServer())
        .get('/management/exams')
        .expect(200);

      expect(res.body.exams).toHaveLength(1);
    });

    it('GET /management/exams/counts returns counts', async () => {
      mockExamService.getExamCounts.mockReturnValue(of({ total: 10, approved: 5, pending: 3, rejected: 2 }));

      const res = await request(app.getHttpServer())
        .get('/management/exams/counts')
        .expect(200);

      expect(res.body.total).toBe(10);
    });
  });

  describe('4.5.8 Get details', () => {
    it('GET /management/exams/:id returns exam details', async () => {
      const mockDetail = { id: 'exam-1', title: 'Test', sections: [] };
      mockExamService.getExamDetails.mockReturnValue(of(mockDetail));

      const res = await request(app.getHttpServer())
        .get('/management/exams/exam-1')
        .expect(200);

      expect(res.body.id).toBe('exam-1');
    });

    it('GET /management/sections/:id returns section details', async () => {
      mockExamService.getSectionDetails.mockReturnValue(of({ id: 'sec-1', name: 'Section 1' }));

      const res = await request(app.getHttpServer())
        .get('/management/sections/sec-1')
        .expect(200);

      expect(res.body.id).toBe('sec-1');
    });

    it('GET /management/questions/:id returns question details', async () => {
      mockExamService.getQuestionDetails.mockReturnValue(of({ id: 'q-1', content: 'What is 2+2?' }));

      const res = await request(app.getHttpServer())
        .get('/management/questions/q-1')
        .expect(200);

      expect(res.body.id).toBe('q-1');
    });
  });

  describe('4.5.9 Move section', () => {
    it('PATCH /management/sections/:id/move reorders sections', async () => {
      mockExamService.moveSection.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/management/sections/sec-1/move')
        .send({ index: 2 })
        .expect(200);

      expect(mockExamService.moveSection).toHaveBeenCalledWith({ id: 'sec-1', index: 2 });
    });
  });


});
