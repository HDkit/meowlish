import { NotificationGatewayModule } from '../notification-gateway/notification.router.module';
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

describe('Notifications (4.8)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { notification: { port: 50053, host: 'localhost' } } })],
        }),
        NotificationGatewayModule,
        RouterModule.register([
          {
            path: '/notifications',
            module: NotificationGatewayModule,
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
      .overrideProvider(NOTIFICATION_CLIENT)
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

  describe('4.8.1 Create notification', () => {
    it('POST /notifications returns 201', async () => {
      mockNotificationService.createNotification.mockReturnValue(of({ id: 'notif-1' }));

      const res = await request(app.getHttpServer())
        .post('/notifications')
        .send({
          recipientId: 'user-2',
          type: 'INFO',
          title: 'New Message',
          message: 'You have a new message',
        })
        .expect(201);

      expect(res.body.id).toBe('notif-1');
    });

    it('POST /notifications validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/notifications')
        .send({ title: 'Incomplete' })
        .expect(400);
    });

    it('POST /notifications can include optional data', async () => {
      mockNotificationService.createNotification.mockReturnValue(of({ id: 'notif-2' }));

      await request(app.getHttpServer())
        .post('/notifications')
        .send({
          recipientId: 'user-2',
          type: 'ALERT',
          title: 'Alert',
          message: 'Something happened',
          data: '{"priority":"high"}',
        })
        .expect(201);

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ data: '{"priority":"high"}' }),
      );
    });
  });

  describe('4.8.2 Get notification', () => {
    it('GET /notifications/:id returns notification', async () => {
      const mockNotif = {
        id: 'notif-1',
        recipientId: 'user-2',
        type: 'INFO',
        title: 'New Message',
        message: 'You have a new message',
        isRead: false,
        createdAt: new Date('2026-05-27'),
      };
      mockNotificationService.getNotification.mockReturnValue(of(mockNotif));

      const res = await request(app.getHttpServer())
        .get('/notifications/notif-1')
        .expect(200);

      expect(res.body.id).toBe('notif-1');
      expect(res.body.title).toBe('New Message');
    });
  });

  describe('4.8.3 Delete notification', () => {
    it('DELETE /notifications/:id returns 200', async () => {
      mockNotificationService.deleteNotification.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/notifications/notif-1')
        .expect(200);

      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith({ id: 'notif-1' });
    });
  });

  describe('4.8.4 List notifications', () => {
    it('GET /notifications returns paginated list', async () => {
      const mockResult = {
        notifications: [
          { id: 'notif-1', recipientId: 'user-1', type: 'INFO', title: 'Hello', message: 'Welcome', isRead: false },
        ],
        totalCount: 1,
        unreadCount: 1,
      };
      mockNotificationService.listNotifications.mockReturnValue(of(mockResult));

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .expect(200);

      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.totalCount).toBe(1);
    });

    it('GET /notifications uses req.user.sub as recipientId', async () => {
      mockNotificationService.listNotifications.mockReturnValue(of({ notifications: [], totalCount: 0, unreadCount: 0 }));

      await request(app.getHttpServer())
        .get('/notifications')
        .expect(200);

      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'user-1' }),
      );
    });

    it('GET /notifications supports query filters', async () => {
      mockNotificationService.listNotifications.mockReturnValue(of({ notifications: [], totalCount: 0, unreadCount: 0 }));

      await request(app.getHttpServer())
        .get('/notifications?type=INFO&isRead=false&page=1&limit=20')
        .expect(200);

      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'INFO', isRead: false, page: 1, limit: 20 }),
      );
    });
  });

  describe('4.8.5 Mark as read', () => {
    it('PATCH /notifications/:id/read marks notification as read', async () => {
      mockNotificationService.markAsRead.mockReturnValue(of({ id: 'notif-1', isRead: true }));

      const res = await request(app.getHttpServer())
        .patch('/notifications/notif-1/read')
        .expect(200);

      expect(res.body.isRead).toBe(true);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith({ id: 'notif-1' });
    });
  });

  describe('4.8.6 Mark all as read', () => {
    it('POST /notifications/read-all marks all as read', async () => {
      mockNotificationService.markAllAsRead.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/notifications/read-all')
        .expect(201);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'user-1' }),
      );
    });
  });
});
