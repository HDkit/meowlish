import { ExamPracticeGatewayController } from '../exam-gateway/exam-practice.router.controller';
import { EXAM_CLIENT } from '../exam-gateway/constants/exam';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GlobalValidationPipe } from '@server/utils';
import { of } from 'rxjs';
import request from 'supertest';
import { Role } from '@server/typing';

const mockPracticeService: Record<string, jest.Mock> = {
  attempt: jest.fn(),
  endAttempt: jest.fn(),
  answer: jest.fn(),
  removeAnswer: jest.fn(),
  toggleFlag: jest.fn(),
  addNote: jest.fn(),
  findExams: jest.fn(),
  getExamDetails: jest.fn(),
  getDetailedQuestionInfo: jest.fn(),
  getExamStats: jest.fn(),
  getAttemptSavedData: jest.fn(),
  getAttemptReview: jest.fn(),
  getUsersAttemptSummary: jest.fn(),
  getUsersAttemptHistory: jest.fn(),
  getUserStats: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockPracticeService),
};

function mockGuard(canActivate: boolean) {
  return { canActivate: () => canActivate };
}

describe('Exam Practice (4.6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { exam: { port: 50051, host: 'localhost' } } })],
        }),
      ],
      controllers: [ExamPracticeGatewayController],
      providers: [
        { provide: EXAM_CLIENT, useValue: mockGrpcClient },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'uid1', roles: [Role.User], permissions: [] };
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue(mockGuard(true))
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard(true))
      .overrideGuard(ResourceAccessGuard)
      .useValue(mockGuard(true))
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.6.1 Start attempt', () => {
    it('POST /practice/new/:id returns 201 + attempt id', async () => {
      mockPracticeService.attempt.mockReturnValue(of({ id: 'attempt-1' }));

      const res = await request(app.getHttpServer())
        .post('/practice/new/exam-1')
        .send({})
        .expect(201);

      expect(res.body.id).toBe('attempt-1');
      expect(mockPracticeService.attempt).toHaveBeenCalledWith(
        expect.objectContaining({ examId: 'exam-1', userId: 'uid1' }),
      );
    });
  });

  describe('4.6.2 Submit attempt', () => {
    it('POST /practice/attempt/:id/submit returns 201', async () => {
      mockPracticeService.endAttempt.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/practice/attempt/attempt-1/submit')
        .expect(201);

      expect(mockPracticeService.endAttempt).toHaveBeenCalledWith({ attemptId: 'attempt-1' });
    });
  });

  describe('4.6.3 Answer question', () => {
    it('POST /practice/attempt/:id/answers/:questionId returns 201', async () => {
      mockPracticeService.answer.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/practice/attempt/attempt-1/answers/q-1')
        .send({ answer: 'A' })
        .expect(201);

      expect(mockPracticeService.answer).toHaveBeenCalledWith(
        expect.objectContaining({ attemptId: 'attempt-1', questionId: 'q-1', answer: 'A' }),
      );
    });

    it('validates required answer field', async () => {
      await request(app.getHttpServer())
        .post('/practice/attempt/attempt-1/answers/q-1')
        .send({})
        .expect(400);
    });
  });

  describe('4.6.4 Remove answer', () => {
    it('DELETE /practice/attempt/:id/answers/:questionId returns 200', async () => {
      mockPracticeService.removeAnswer.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/practice/attempt/attempt-1/answers/q-1')
        .expect(200);
    });
  });

  describe('4.6.5 Toggle flag', () => {
    it('PATCH /practice/attempt/:id/answers/:questionId/flag returns flag state', async () => {
      mockPracticeService.toggleFlag.mockReturnValue(of({ state: true }));

      const res = await request(app.getHttpServer())
        .patch('/practice/attempt/attempt-1/answers/q-1/flag')
        .expect(200);

      expect(res.body.state).toBe(true);
    });
  });

  describe('4.6.6 Add note', () => {
    it('PATCH /practice/attempt/:id/answers/:questionId/note returns 200', async () => {
      mockPracticeService.addNote.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/practice/attempt/attempt-1/answers/q-1/note')
        .send({ note: 'Review later' })
        .expect(200);
    });

    it('validates note length', async () => {
      await request(app.getHttpServer())
        .patch('/practice/attempt/attempt-1/answers/q-1/note')
        .send({ note: 'x'.repeat(501) })
        .expect(400);
    });
  });

  describe('4.6.7 Public exam listing', () => {
    it('GET /practice returns exams', async () => {
      const mockExams = { exams: [{ id: 'exam-1', name: 'Math' }], nextCursor: null, prevCursor: null };
      mockPracticeService.findExams.mockReturnValue(of(mockExams));

      const res = await request(app.getHttpServer())
        .get('/practice')
        .expect(200);

      expect(res.body.exams).toHaveLength(1);
    });
  });

  describe('4.6.8 Public exam details', () => {
    it('GET /practice/info/:id/details returns exam details', async () => {
      mockPracticeService.getExamDetails.mockReturnValue(of({ id: 'exam-1', name: 'Math' }));

      const res = await request(app.getHttpServer())
        .get('/practice/info/exam-1/details')
        .expect(200);

      expect(res.body.id).toBe('exam-1');
    });
  });

  describe('4.6.9 Public question details', () => {
    it('GET /practice/questions/:id/details returns question details', async () => {
      mockPracticeService.getDetailedQuestionInfo.mockReturnValue(of({ id: 'q-1', content: 'What is 2+2?' }));

      const res = await request(app.getHttpServer())
        .get('/practice/questions/q-1/details')
        .expect(200);

      expect(res.body.id).toBe('q-1');
    });
  });

  describe('4.6.10 Public exam stats', () => {
    it('GET /practice/info/:id/stats returns stats', async () => {
      mockPracticeService.getExamStats.mockReturnValue(of({ averageScoreInPercentage: 75 }));

      const res = await request(app.getHttpServer())
        .get('/practice/info/exam-1/stats')
        .expect(200);

      expect(res.body.averageScoreInPercentage).toBe(75);
    });
  });

  describe('4.6.11 Attempt data and review', () => {
    it('GET /practice/attempt/:id/saved returns attempt data', async () => {
      mockPracticeService.getAttemptSavedData.mockReturnValue(of({ durationLimit: 3600 }));

      const res = await request(app.getHttpServer())
        .get('/practice/attempt/attempt-1/saved')
        .expect(200);

      expect(res.body.durationLimit).toBe(3600);
    });

    it('GET /practice/attempt/:id/review returns review data', async () => {
      mockPracticeService.getAttemptReview.mockReturnValue(of({ totalPoints: 100 }));

      const res = await request(app.getHttpServer())
        .get('/practice/attempt/attempt-1/review')
        .expect(200);

      expect(res.body.totalPoints).toBe(100);
    });
  });

  describe('4.6.12 User stats and history', () => {
    it('GET /practice/my/calendar returns calendar data', async () => {
      mockPracticeService.getUsersAttemptSummary.mockReturnValue(of({ history: {} }));

      const res = await request(app.getHttpServer())
        .get('/practice/my/calendar')
        .expect(200);

      expect(res.body.history).toBeDefined();
    });

    it('GET /practice/my/history returns attempt history', async () => {
      mockPracticeService.getUsersAttemptHistory.mockReturnValue(of({ attempts: [] }));

      const res = await request(app.getHttpServer())
        .get('/practice/my/history')
        .expect(200);

      expect(res.body.attempts).toEqual([]);
    });

    it('GET /practice/my/stats returns user stats', async () => {
      mockPracticeService.getUserStats.mockReturnValue(of({ attemptCounts: 5 }));

      const res = await request(app.getHttpServer())
        .get('/practice/my/stats')
        .expect(200);

      expect(res.body.attemptCounts).toBe(5);
    });
  });
});
