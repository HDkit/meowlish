import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  Inject,
  OnModuleInit,
  Res,
  Req,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { RpcException } from '@nestjs/microservices';
import { Role, Permission } from '@server/typing';
import { Response } from 'express';

// ---------------------------------------------------------------------------
// Injection tokens
// ---------------------------------------------------------------------------
const EXAM_CLIENT = 'EXAM_CLIENT';
const AUTH_CLIENT = 'AUTH_CLIENT';
const LINKS_CLIENT = 'LINKS_CLIENT';

// ---------------------------------------------------------------------------
// Mock gRPC services
// ---------------------------------------------------------------------------
const mockGoalService: Record<string, jest.Mock> = {
  setGoal: jest.fn(),
  getGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
};

const mockLinkService: Record<string, jest.Mock> = {
  createLink: jest.fn(),
  approveLink: jest.fn(),
  rejectLink: jest.fn(),
  removeLink: jest.fn(),
};

const mockAuthService: Record<string, jest.Mock> = {
  registerOrLoginGoogle: jest.fn(),
  addGoogleCredential: jest.fn(),
  removeCredential: jest.fn(),
};

const mockExamGrpcClient = { getService: jest.fn().mockReturnValue(mockGoalService) };
const mockLinksGrpcClient = { getService: jest.fn().mockReturnValue(mockLinkService) };
const mockAuthGrpcClient = { getService: jest.fn().mockReturnValue(mockAuthService) };

const mockWinstonLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Inline test controllers
// ---------------------------------------------------------------------------

// ---- Weekly Goals (uses existing GoalService gRPC proto) ----

@Controller('goals')
class WeeklyGoalsTestController implements OnModuleInit {
  private goalService!: typeof mockGoalService;

  constructor(@Inject(EXAM_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.goalService = this.client.getService('GoalService') as never;
  }

  @Post('weekly')
  createWeeklyGoal(@Body() body: { date: string; target: number; type: string }) {
    return this.goalService.setGoal(body);
  }

  @Get('weekly')
  listWeeklyGoals(@Query('from') from?: string, @Query('to') to?: string) {
    // Return a list-like response from the single getGoal
    return this.goalService.getGoal({ from, to });
  }

  @Patch('weekly/:id')
  updateGoalProgress(@Param('id') id: string, @Body() body: { progress: number }) {
    return this.goalService.updateGoal({ id, ...body });
  }

  @Post('weekly/:id/complete')
  completeGoal(@Param('id') id: string) {
    return this.goalService.updateGoal({ id, progress: 100, status: 'completed' });
  }

  @Get('weekly/stats')
  getWeeklyStats() {
    return this.goalService.getGoal({ stats: true });
  }
}

// ---- Parent-Teacher Links ----

@Controller('links')
class ParentTeacherLinkTestController implements OnModuleInit {
  private linkService!: typeof mockLinkService;

  constructor(@Inject(LINKS_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.linkService = this.client.getService('LinkService') as never;
  }

  @Post('parent-teacher')
  createLink(@Body() body: { parentId: string; teacherId: string }) {
    return this.linkService.createLink(body);
  }

  @Post('parent-teacher/approve')
  approveLink(@Body() body: { linkId: string }) {
    return this.linkService.approveLink(body);
  }

  @Post('parent-teacher/reject')
  rejectLink(@Body() body: { linkId: string }) {
    return this.linkService.rejectLink(body);
  }

  @Delete('parent-teacher/:id')
  removeLink(@Param('id') id: string) {
    return this.linkService.removeLink({ id });
  }
}

// ---- Google Login ----

@Controller('auth')
class GoogleLoginTestController implements OnModuleInit {
  private authService!: typeof mockAuthService;

  constructor(@Inject(AUTH_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService('AuthService') as never;
  }

  @Post('google')
  initiateGoogleOAuth(@Body() body: { redirectUri: string }) {
    // Returns the Google OAuth URL to redirect the user
    return of({ url: `https://accounts.google.com/o/oauth2/auth?redirect_uri=${body.redirectUri}` });
  }

  @Get('google/callback')
  handleGoogleCallback(@Query('code') code: string, @Res({ passthrough: true }) _res: Response) {
    return this.authService.registerOrLoginGoogle({ code });
  }

  @Post('google/link')
  linkGoogleAccount(@Body() body: { identityId: string; googleToken: string }) {
    return this.authService.addGoogleCredential(body);
  }

  @Post('google/unlink')
  unlinkGoogleAccount(@Body() body: { identityId: string; credentialId: string }) {
    return this.authService.removeCredential(body);
  }
}

// ===========================================================================
// Test suite
// ===========================================================================

describe('Weekly Goals, Parent-Teacher Link & Google Login Integration', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ({
              env: 'test',
              microservicesConnection: {
                exam: { port: 50051, host: 'localhost' },
                auth: { port: 50050, host: 'localhost' },
                links: { port: 50062, host: 'localhost' },
              },
            }),
          ],
        }),
      ],
      controllers: [
        WeeklyGoalsTestController,
        ParentTeacherLinkTestController,
        GoogleLoginTestController,
      ],
      providers: [
        { provide: EXAM_CLIENT, useValue: mockExamGrpcClient },
        { provide: LINKS_CLIENT, useValue: mockLinksGrpcClient },
        { provide: AUTH_CLIENT, useValue: mockAuthGrpcClient },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        {
          provide: APP_FILTER,
          useFactory: () =>
            new gRPC2HttpExceptionFilter(
              new AppLoggerService(mockWinstonLogger as never) as never,
            ),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();

    moduleRef.get(WeeklyGoalsTestController).onModuleInit();
    moduleRef.get(ParentTeacherLinkTestController).onModuleInit();
    moduleRef.get(GoogleLoginTestController).onModuleInit();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // WEEKLY GOALS (5 tests)
  // =========================================================================

  describe('Weekly Goals – POST /goals/weekly', () => {
    it('ECP: creates weekly goal with valid target', async () => {
      mockGoalService.setGoal.mockReturnValue(
        of({ uid: 'user_1', date: '2026-06-08', target: 10, type: 'IELTS' }),
      );

      const res = await request(app.getHttpServer())
        .post('/goals/weekly')
        .send({ date: '2026-06-08T00:00:00Z', target: 10, type: 'IELTS' })
        .expect(201);

      expect(res.body.uid).toBe('user_1');
      expect(res.body.target).toBe(10);
      expect(res.body.type).toBe('IELTS');
      expect(mockGoalService.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({ target: 10, type: 'IELTS' }),
      );
    });
  });

  describe('Weekly Goals – GET /goals/weekly', () => {
    it('lists weekly goals with date range', async () => {
      mockGoalService.getGoal.mockReturnValue(
        of({
          uid: 'user_1',
          date: '2026-06-08',
          target: 10,
          type: 'IELTS',
          progress: 60,
        }),
      );

      const res = await request(app.getHttpServer())
        .get('/goals/weekly?from=2026-06-01&to=2026-06-07')
        .expect(200);

      expect(res.body.target).toBe(10);
      expect(mockGoalService.getGoal).toHaveBeenCalledWith(
        { from: '2026-06-01', to: '2026-06-07' },
      );
    });
  });

  describe('Weekly Goals – PATCH /goals/weekly/:id', () => {
    it('Control Flow: updates goal progress and marks complete', async () => {
      // Step 1: create
      mockGoalService.setGoal.mockReturnValue(
        of({ uid: 'user_1', date: '2026-06-08', target: 10, type: 'IELTS', progress: 0 }),
      );
      const createRes = await request(app.getHttpServer())
        .post('/goals/weekly')
        .send({ date: '2026-06-08T00:00:00Z', target: 10, type: 'IELTS' })
        .expect(201);
      const goalId = createRes.body.uid;

      // Step 2: update progress
      mockGoalService.updateGoal.mockReturnValue(
        of({ uid: goalId, target: 10, progress: 50 }),
      );
      const updateRes = await request(app.getHttpServer())
        .patch(`/goals/weekly/${goalId}`)
        .send({ progress: 50 })
        .expect(200);

      expect(updateRes.body.progress).toBe(50);
      expect(mockGoalService.updateGoal).toHaveBeenCalledWith(
        { id: goalId, progress: 50 },
      );

      // Step 3: complete
      mockGoalService.updateGoal.mockReturnValue(
        of({ uid: goalId, target: 10, progress: 100, status: 'completed' }),
      );
      const completeRes = await request(app.getHttpServer())
        .post(`/goals/weekly/${goalId}/complete`)
        .expect(201);

      expect(completeRes.body.status).toBe('completed');
      expect(completeRes.body.progress).toBe(100);
    });
  });

  describe('Weekly Goals – POST /goals/weekly/:id/complete', () => {
    it('marks goal as completed', async () => {
      mockGoalService.updateGoal.mockReturnValue(
        of({ uid: 'goal_1', target: 5, progress: 100, status: 'completed' }),
      );

      const res = await request(app.getHttpServer())
        .post('/goals/weekly/goal_1/complete')
        .expect(201);

      expect(res.body.status).toBe('completed');
      expect(res.body.progress).toBe(100);
      expect(mockGoalService.updateGoal).toHaveBeenCalledWith(
        { id: 'goal_1', progress: 100, status: 'completed' },
      );
    });
  });

  describe('Weekly Goals – GET /goals/weekly/stats', () => {
    it('returns weekly goal statistics', async () => {
      mockGoalService.getGoal.mockReturnValue(
        of({
          uid: 'user_1',
          stats: {
            total: 3,
            completed: 2,
            inProgress: 1,
            averageProgress: 73,
          },
        }),
      );

      const res = await request(app.getHttpServer())
        .get('/goals/weekly/stats')
        .expect(200);

      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total).toBe(3);
      expect(res.body.stats.completed).toBe(2);
    });
  });

  // =========================================================================
  // PARENT-TEACHER LINK (4 tests using Decision Table)
  // =========================================================================

  describe('Parent-Teacher Link – POST /links/parent-teacher', () => {
    it('ECP: creates a parent-teacher link with valid data', async () => {
      mockLinkService.createLink.mockReturnValue(
        of({ id: 'link_1', parentId: 'parent_1', teacherId: 'teacher_1', status: 'pending' }),
      );

      const res = await request(app.getHttpServer())
        .post('/links/parent-teacher')
        .send({ parentId: 'parent_1', teacherId: 'teacher_1' })
        .expect(201);

      expect(res.body.id).toBe('link_1');
      expect(res.body.status).toBe('pending');
      expect(mockLinkService.createLink).toHaveBeenCalledWith(
        { parentId: 'parent_1', teacherId: 'teacher_1' },
      );
    });
  });

  describe('Parent-Teacher Link – POST /links/parent-teacher/approve', () => {
    it('approves a pending link', async () => {
      mockLinkService.approveLink.mockReturnValue(
        of({ id: 'link_1', status: 'approved' }),
      );

      const res = await request(app.getHttpServer())
        .post('/links/parent-teacher/approve')
        .send({ linkId: 'link_1' })
        .expect(201);

      expect(res.body.status).toBe('approved');
      expect(mockLinkService.approveLink).toHaveBeenCalledWith({ linkId: 'link_1' });
    });
  });

  describe('Parent-Teacher Link – POST /links/parent-teacher/reject', () => {
    it('Decision Table: rejects a pending link (opposite of approve)', async () => {
      mockLinkService.rejectLink.mockReturnValue(
        of({ id: 'link_1', status: 'rejected' }),
      );

      const res = await request(app.getHttpServer())
        .post('/links/parent-teacher/reject')
        .send({ linkId: 'link_1' })
        .expect(201);

      // Decision Table: approve vs reject
      // | Action  | Input State | Output   |
      // |---------|-------------|----------|
      // | Approve | pending     | approved |
      // | Reject  | pending     | rejected |
      expect(res.body.status).toBe('rejected');
      expect(mockLinkService.rejectLink).toHaveBeenCalledWith({ linkId: 'link_1' });
    });
  });

  describe('Parent-Teacher Link – DELETE /links/parent-teacher/:id', () => {
    it('removes a link', async () => {
      mockLinkService.removeLink.mockReturnValue(of({ success: true }));

      const res = await request(app.getHttpServer())
        .delete('/links/parent-teacher/link_1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockLinkService.removeLink).toHaveBeenCalledWith({ id: 'link_1' });
    });
  });

  // =========================================================================
  // GOOGLE LOGIN (4 tests using Control Flow)
  // =========================================================================

  describe('Google Login – POST /auth/google', () => {
    it('ECP: initiates Google OAuth flow with valid redirect', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ redirectUri: 'http://localhost:4200/auth/callback' })
        .expect(201);

      expect(res.body.url).toContain('accounts.google.com');
      expect(res.body.url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A4200%2Fauth%2Fcallback');
    });
  });

  describe('Google Login – GET /auth/google/callback', () => {
    it('handles callback with valid code and returns tokens', async () => {
      mockAuthService.registerOrLoginGoogle.mockReturnValue(
        of({ accessToken: 'google-at-123', refreshToken: 'google-rt-456' }),
      );

      const res = await request(app.getHttpServer())
        .get('/auth/google/callback?code=valid_auth_code')
        .expect(200);

      expect(res.body.accessToken).toBe('google-at-123');
      expect(mockAuthService.registerOrLoginGoogle).toHaveBeenCalledWith(
        { code: 'valid_auth_code' },
      );
    });
  });

  describe('Google Login – POST /auth/google/link', () => {
    it('Control Flow: links Google account after login', async () => {
      // Step 1: login via google (registerOrLoginGoogle)
      mockAuthService.registerOrLoginGoogle.mockReturnValue(
        of({ accessToken: 'at_1', refreshToken: 'rt_1' }),
      );
      const loginRes = await request(app.getHttpServer())
        .get('/auth/google/callback?code=login_code')
        .expect(200);
      expect(loginRes.body.accessToken).toBe('at_1');

      // Step 2: link additional Google credential
      mockAuthService.addGoogleCredential.mockReturnValue(
        of({ credentialId: 'google_cred_1', provider: 'google' }),
      );
      const linkRes = await request(app.getHttpServer())
        .post('/auth/google/link')
        .send({ identityId: 'user_1', googleToken: 'new_google_token' })
        .expect(201);

      expect(linkRes.body.credentialId).toBe('google_cred_1');
      expect(mockAuthService.addGoogleCredential).toHaveBeenCalledWith(
        { identityId: 'user_1', googleToken: 'new_google_token' },
      );
    });
  });

  describe('Google Login – POST /auth/google/unlink', () => {
    it('unlinks Google account', async () => {
      mockAuthService.removeCredential.mockReturnValue(of({ success: true }));

      const res = await request(app.getHttpServer())
        .post('/auth/google/unlink')
        .send({ identityId: 'user_1', credentialId: 'google_cred_1' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockAuthService.removeCredential).toHaveBeenCalledWith(
        { identityId: 'user_1', credentialId: 'google_cred_1' },
      );
    });
  });
});
