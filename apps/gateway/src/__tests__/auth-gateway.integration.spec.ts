import { JwtRefreshAuthGuard } from '../auth/guards/jwt-refresh-auth.guard';
import { AuthGatewayController } from '../auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from '../auth-gateway/constants/auth';
import { JwtRefreshStrategy } from '../auth-gateway/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '../auth-gateway/strategies/jwt.strategy';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { RpcException } from '@nestjs/microservices';
import { INestApplication } from '@nestjs/common';

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

const mockAuthService: Record<string, jest.Mock> = {
  registerMail: jest.fn(),
  loginMail: jest.fn(),
  refresh: jest.fn(),
  validateAccess: jest.fn(),
  validateRefresh: jest.fn(),
  logOutAll: jest.fn(),
  getCredentials: jest.fn(),
  removeCredential: jest.fn(),
  addMailCredential: jest.fn(),
  updateMailPassword: jest.fn(),
  hydrateIdentity: jest.fn(),
  hydrateIdentities: jest.fn(),
  findIdentities: jest.fn(),
  findIdentitiesByPhone: jest.fn(),
  findIdentityIds: jest.fn(),
  getRoleList: jest.fn(),
  getPermList: jest.fn(),
  assignRoleTo: jest.fn(),
  removeRoleFrom: jest.fn(),
  updateIdentity: jest.fn(),
  lockIdentity: jest.fn(),
  unlockIdentity: jest.fn(),
  registerOrLoginGoogle: jest.fn(),
  addGoogleCredential: jest.fn(),
  connectGoogleCalendar: jest.fn(),
  disconnectGoogleCalendar: jest.fn(),
  getGoogleCalendarToken: jest.fn(),
  refreshGoogleCalendarToken: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockAuthService),
};

const mockRedisInstance: Record<string, jest.Mock> = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockRedisService = {
  getOrThrow: jest.fn().mockReturnValue(mockRedisInstance),
};

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

describe('AuthGateway', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            (): Record<string, unknown> => ({
              env: 'test',
              redis: { host: 'localhost', port: 6379 },
              jwt: { accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret' },
              googleOAuth2: { clientId: 'test-client-id', secret: 'test-client-secret' },
              microservicesConnection: {
                auth: { port: 50050, host: 'localhost' },
                exam: { port: 50051, host: 'localhost' },
                file: { port: 50052, host: 'localhost' },
                achievement: { port: 50053, host: 'localhost' },
                live: { port: 50054, host: 'localhost', portWs: 50055, hostWs: 'localhost' },
                notification: { port: 50056, host: 'localhost', httpPort: 50057 },
                resource: { port: 50058, host: 'localhost' },
              },
              vps: { baseUrl: 'http://localhost:3000', feLoginRedirectUrl: 'http://localhost:4200/login' },
            }),
          ],
        }),
      ],
      controllers: [AuthGatewayController],
      providers: [
        { provide: AUTH_CLIENT, useValue: mockGrpcClient },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtStrategy, useValue: {} },
        { provide: JwtRefreshStrategy, useValue: {} },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
      ],
    })
      .overrideGuard(JwtRefreshAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'test-identity-id' };
          return true;
        },
      })
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

  describe('4.1 POST /auth/register', () => {
    const validBody = { mail: 'a@b.com', password: 'Abc12345!', username: 'test' };

    it('4.1.1 Valid registration returns 201 + tokens', async () => {
      mockAuthService.registerMail.mockReturnValue(of(mockTokens));

      const res = await request(app.getHttpServer())
        .post('/register')
        .send(validBody)
        .expect(201);

      expect(res.body.accessToken).toBe('mock-access-token');
      expect(res.body.refreshToken).toBe('mock-refresh-token');
      expect(mockAuthService.registerMail).toHaveBeenCalledWith(validBody);
    });

    it('4.1.2 Duplicate email returns 409 Conflict', async () => {
      mockAuthService.registerMail.mockReturnValue(
        throwError(() => new RpcException({ code: 6, message: 'already exists' })),
      );

      await request(app.getHttpServer())
        .post('/register')
        .send(validBody)
        .expect(409);
    });

    it('4.1.3 Invalid email format returns 400', async () => {
      await request(app.getHttpServer())
        .post('/register')
        .send({ mail: 'notanemail', password: 'Abc123!', username: 'test' })
        .expect(400);
    });

    it('4.1.4 Password < 6 chars returns 400', async () => {
      await request(app.getHttpServer())
        .post('/register')
        .send({ mail: 'a@b.com', password: 'Abc12', username: 'test' })
        .expect(400);
    });

    it('4.1.6 Empty username returns 400', async () => {
      await request(app.getHttpServer())
        .post('/register')
        .send({ mail: 'a@b.com', password: 'Abc123!', username: '' })
        .expect(400);
    });

    it('4.1.7 Missing mail field returns 400', async () => {
      await request(app.getHttpServer())
        .post('/register')
        .send({ password: 'Abc123!', username: 'test' })
        .expect(400);
    });

    it('4.1.8 SQL injection attempt in email returns 400', async () => {
      await request(app.getHttpServer())
        .post('/register')
        .send({ mail: "' OR 1=1--", password: 'Abc123!', username: 'test' })
        .expect(400);
    });
  });

  describe('4.2 POST /auth/login', () => {
    const validCreds = { mail: 'a@b.com', password: 'Abc123!' };

    it('4.2.1 Correct credentials returns 200 + tokens', async () => {
      mockAuthService.loginMail.mockReturnValue(of(mockTokens));

      const res = await request(app.getHttpServer())
        .post('/login')
        .send(validCreds)
        .expect(201);

      expect(res.body.accessToken).toBe('mock-access-token');
      expect(mockAuthService.loginMail).toHaveBeenCalledWith(validCreds);
    });

    it('4.2.2 Wrong password returns 401', async () => {
      mockAuthService.loginMail.mockReturnValue(
        throwError(() => new RpcException({ code: 16, message: 'unauthenticated' })),
      );

      await request(app.getHttpServer())
        .post('/login')
        .send({ mail: 'a@b.com', password: 'wrongpass' })
        .expect(401);
    });

    it('4.2.4 Non-existent email returns 404', async () => {
      mockAuthService.loginMail.mockReturnValue(
        throwError(() => new RpcException({ code: 5, message: 'not found' })),
      );

      await request(app.getHttpServer())
        .post('/login')
        .send({ mail: 'no@one.com', password: 'Abc123!' })
        .expect(404);
    });
  });

  describe('4.3 POST /auth/refresh', () => {
    it('4.3.1 Valid refresh token returns 200', async () => {
      mockAuthService.refresh.mockReturnValue(of(mockTokens));

      const res = await request(app.getHttpServer())
        .post('/refresh')
        .set('Authorization', 'Bearer valid-refresh-token')
        .expect(201);

      expect(res.body.accessToken).toBe('mock-access-token');
    });

    it('4.3.2 Revoked token returns 401', async () => {
      mockAuthService.refresh.mockReturnValue(
        throwError(() => new RpcException({ code: 16, message: 'token revoked' })),
      );

      await request(app.getHttpServer())
        .post('/refresh')
        .set('Authorization', 'Bearer revoked-token')
        .expect(401);
    });
  });
});
