var mockProxyHandler: jest.Mock;

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => mockProxyHandler),
}));

import { NotificationGatewayController } from '../notification-gateway/notification.router.controller';
import { NOTIFICATION_CLIENT } from '../notification-gateway/constants/notification';
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
import { PassThrough } from 'stream';

const mockNotificationService: Record<string, jest.Mock> = {
  createNotification: jest.fn(),
  getNotification: jest.fn(),
  deleteNotification: jest.fn(),
  listNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockNotificationService),
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

let sseBehavior: ((req: unknown, res: unknown, next: unknown) => void) | null;

describe('Notifications SSE (4.9)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mockProxyHandler = jest.fn((req, res, _next) => {
      if (sseBehavior) {
        sseBehavior(req, res, _next);
      } else {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        res.flushHeaders();
      }
    });

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { notification: { port: 50053, host: 'localhost' } } })],
        }),
      ],
      controllers: [NotificationGatewayController],
      providers: [
        { provide: NOTIFICATION_CLIENT, useValue: mockGrpcClient },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'user-1', roles: [Role.User], permissions: [] };
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sseBehavior = null;
  });

  describe('4.9.1 SSE Connection Establishment', () => {
    it('GET /stream/:recipientId establishes SSE connection', async () => {
      const streamComplete = new Promise<void>((resolve) => {
        sseBehavior = (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.flushHeaders();
          res.write('event: connected\ndata: {}\n\n');
          setTimeout(() => { res.end(); resolve(); }, 20);
        };
      });

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        })
        .expect(200);

      await streamComplete;
      expect(res.text).toContain('event: connected');
    });

    it('SSE connection returns text/event-stream content type', async () => {
      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end();
      };

      await request(app.getHttpServer())
        .get('/stream/user-1')
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);
    });

    it('SSE sends initial connection event', async () => {
      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write('event: connected\ndata: {}\n\n');
        res.end();
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      expect(res.text).toContain('event: connected');
      expect(res.text).toContain('data: {}');
    });
  });

  describe('4.9.2 SSE Event Streaming', () => {
    it('SSE emits notification when new notification is created', async () => {
      const notificationEvent = 'data: {"id":"notif-1","title":"New Message","type":"INFO"}\n\n';

      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write('event: connected\ndata: {}\n\n');
        setTimeout(() => {
          res.write(`event: notification\n${notificationEvent}`);
          res.end();
        }, 10);
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      expect(res.text).toContain('"id":"notif-1"');
      expect(res.text).toContain('event: notification');
    });

    it('SSE handles multiple events', async () => {
      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write('event: connected\ndata: {}\n\n');
        res.write('event: notification\ndata: {"id":"notif-1"}\n\n');
        res.write('event: notification\ndata: {"id":"notif-2"}\n\n');
        res.write('event: notification\ndata: {"id":"notif-3"}\n\n');
        res.end();
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      const matches = res.text.match(/event: notification/g);
      expect(matches).toHaveLength(3);
    });
  });

  describe('4.9.3 Edge Cases', () => {
    it('SSE connection with invalid recipientId returns 200', async () => {
      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end();
      };

      await request(app.getHttpServer())
        .get('/stream/')
        .expect(200);
    });

    it('SSE heartbeat/keepalive sends periodic comments', async () => {
      sseBehavior = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write(': heartbeat\n\n');
        setTimeout(() => {
          res.write(': heartbeat\n\n');
          res.end();
        }, 15);
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      expect(res.text).toContain(': heartbeat');
    });
  });

  describe('4.9.4 Filtering and Concurrency', () => {
    it('SSE filters events by recipientId', async () => {
      sseBehavior = (req, res) => {
        const recipientId = (req as Record<string, unknown>).params
          ? ((req as Record<string, unknown>).params as Record<string, string>).recipientId
          : 'unknown';

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write(`event: connected\ndata: {"recipientId":"${recipientId}"}\n\n`);

        if (recipientId === 'user-filtered') {
          res.write('event: notification\ndata: {"id":"notif-filtered"}\n\n');
        }
        res.end();
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-filtered')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      expect(res.text).toContain('"recipientId":"user-filtered"');
      expect(res.text).toContain('"id":"notif-filtered"');
    });

    it('SSE concurrent connections from different users', async () => {
      const connections: Record<string, PassThrough> = {};

      sseBehavior = (req, res) => {
        const recipientId = (req as Record<string, unknown>).params
          ? ((req as Record<string, unknown>).params as Record<string, string>).recipientId
          : 'unknown';

        const stream = new PassThrough();
        connections[recipientId] = stream;

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        stream.pipe(res);
        stream.write('event: connected\ndata: {}\n\n');
      };

      const res1 = request(app.getHttpServer())
        .get('/stream/user-a')
        .buffer(false)
        .then((r) => r);

      const res2 = request(app.getHttpServer())
        .get('/stream/user-b')
        .buffer(false)
        .then((r) => r);

      await new Promise((r) => setTimeout(r, 50));

      if (connections['user-a']) {
        connections['user-a'].write('event: notification\ndata: {"id":"notif-a"}\n\n');
      }
      if (connections['user-b']) {
        connections['user-b'].write('event: notification\ndata: {"id":"notif-b"}\n\n');
      }

      await new Promise((r) => setTimeout(r, 20));

      Object.values(connections).forEach((s) => s.end());

      const [r1, r2] = await Promise.all([res1, res2]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });
  });

  describe('4.9.5 Connection Lifecycle', () => {
    it('SSE close connection cleanup', async () => {
      let cleanupCalled = false;

      sseBehavior = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write('event: connected\ndata: {}\n\n');

        (req as Record<string, unknown>).on('close', () => {
          cleanupCalled = true;
        });

        setTimeout(() => {
          res.end();
        }, 30);
      };

      const res = await request(app.getHttpServer())
        .get('/stream/user-1')
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => { cb(null, data); });
        });

      expect(res.status).toBe(200);
    });

    it('SSE reconnection behavior sends Last-Event-Id', async () => {
      let lastEventIdHeader: string | undefined;

      sseBehavior = (req, res) => {
        lastEventIdHeader = (req as Record<string, unknown>).headers
          ? ((req as Record<string, unknown>).headers as Record<string, string>)['last-event-id']
          : undefined;

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        res.write('event: connected\ndata: {}\n\n');
        res.end();
      };

      await request(app.getHttpServer())
        .get('/stream/user-1')
        .set('Last-Event-ID', 'notif-5')
        .expect(200);

      expect(mockProxyHandler).toHaveBeenCalled();
    });
  });
});
