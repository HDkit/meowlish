import { AchievementGatewayModule } from '../achievement-gateway/achievement.router.module';
import { ACHIEVEMENT_CLIENT } from '../achievement-gateway/constants/achievement';
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

const mockAchievementService: Record<string, jest.Mock> = {
  getAll: jest.fn(),
  getUsersBadges: jest.fn(),
  getUsersProgess: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockAchievementService),
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

describe('Achievement (4.10)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { achievement: { port: 50055, host: 'localhost' } } })],
        }),
        AchievementGatewayModule,
        RouterModule.register([
          {
            path: '/achievements',
            module: AchievementGatewayModule,
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
      .overrideProvider(ACHIEVEMENT_CLIENT)
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

  describe('4.10.1 Get all badges', () => {
    it('GET /achievements/badges returns all badges', async () => {
      const mockBadges = {
        badges: [
          { name: 'first_login', displayName: 'First Login', description: 'Log in for the first time' },
        ],
      };
      mockAchievementService.getAll.mockReturnValue(of(mockBadges));

      const res = await request(app.getHttpServer())
        .get('/achievements/badges')
        .expect(200);

      expect(res.body.badges).toHaveLength(1);
      expect(res.body.badges[0].name).toBe('first_login');
    });
  });

  describe('4.10.2 Get my badges', () => {
    it('GET /achievements/badges/my returns user badges', async () => {
      const mockBadges = {
        badges: [
          { id: 'badge-1', name: 'first_login', displayName: 'First Login', description: 'Log in' },
        ],
        nextCursor: null,
        prevCursor: null,
      };
      mockAchievementService.getUsersBadges.mockReturnValue(of(mockBadges));

      const res = await request(app.getHttpServer())
        .get('/achievements/badges/my')
        .expect(200);

      expect(res.body.badges).toHaveLength(1);
      expect(mockAchievementService.getUsersBadges).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('GET /achievements/badges/my supports cursor and limit', async () => {
      mockAchievementService.getUsersBadges.mockReturnValue(of({ badges: [], nextCursor: null, prevCursor: null }));

      await request(app.getHttpServer())
        .get('/achievements/badges/my?cursor=abc&limit=10')
        .expect(200);

      expect(mockAchievementService.getUsersBadges).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', cursor: 'abc', limit: 10 }),
      );
    });

    it('GET /achievements/badges/my rejects negative limit', async () => {
      await request(app.getHttpServer())
        .get('/achievements/badges/my?limit=-1')
        .expect(400);
    });
  });

  describe('4.10.3 Get my progress', () => {
    it('GET /achievements/badges/my/progress returns progress', async () => {
      const mockProgress = {
        loginProgress: { longestStreak: 5, streak: 3, total: 10 },
        submissionProgress: { goodScore: 8, perfectScore: 2, total: 15 },
      };
      mockAchievementService.getUsersProgess.mockReturnValue(of(mockProgress));

      const res = await request(app.getHttpServer())
        .get('/achievements/badges/my/progress')
        .expect(200);

      expect(res.body.loginProgress.streak).toBe(3);
      expect(res.body.submissionProgress.total).toBe(15);
    });
  });

  describe('4.10.4 Get someone else badges', () => {
    it('GET /achievements/badges/:uid returns user badges', async () => {
      const mockBadges = {
        badges: [
          { id: 'badge-2', name: 'streak_7', displayName: 'Weekly Streak', description: '7-day streak' },
        ],
      };
      mockAchievementService.getUsersBadges.mockReturnValue(of(mockBadges));

      const res = await request(app.getHttpServer())
        .get('/achievements/badges/user-42')
        .expect(200);

      expect(res.body.badges).toHaveLength(1);
      expect(mockAchievementService.getUsersBadges).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-42' }),
      );
    });
  });
});
