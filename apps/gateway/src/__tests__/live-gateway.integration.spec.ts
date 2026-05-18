import { LiveGatewayController } from '../live-gateway/live.router.controller';
import { LIVE_CLIENT } from '../live-gateway/constants/live';
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

const mockChatService: Record<string, jest.Mock> = {
  getRoomList: jest.fn(),
  createRoom: jest.fn(),
  removeRoom: jest.fn(),
  updateRoomSchedule: jest.fn(),
  banUserFromRoom: jest.fn(),
  unbanUserFromRoom: jest.fn(),
  getChatLog: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockChatService),
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

describe('Live Chat (4.7)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { live: { port: 50052, host: 'localhost' } } })],
        }),
      ],
      controllers: [LiveGatewayController],
      providers: [
        { provide: LIVE_CLIENT, useValue: mockGrpcClient },
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.7.1 List rooms', () => {
    it('GET /rooms returns room list', async () => {
      const mockResult = { rooms: [{ id: 'room-1', name: 'English Chat' }], nextCursor: null, prevCursor: null };
      mockChatService.getRoomList.mockReturnValue(of(mockResult));

      const res = await request(app.getHttpServer())
        .get('/rooms')
        .expect(200);

      expect(res.body.rooms).toHaveLength(1);
      expect(res.body.rooms[0].name).toBe('English Chat');
    });

    it('GET /rooms supports cursor and limit', async () => {
      mockChatService.getRoomList.mockReturnValue(of({ rooms: [], nextCursor: null, prevCursor: 'abc' }));

      await request(app.getHttpServer())
        .get('/rooms?cursor=abc&limit=20')
        .expect(200);

      expect(mockChatService.getRoomList).toHaveBeenCalledWith({ cursor: 'abc', limit: 20 });
    });
  });

  describe('4.7.2 Create room', () => {
    it('POST /rooms returns 201', async () => {
      mockChatService.createRoom.mockReturnValue(of({ id: 'room-1' }));

      const res = await request(app.getHttpServer())
        .post('/rooms')
        .send({ name: 'New Room' })
        .expect(201);

      expect(res.body.id).toBe('room-1');
    });

    it('POST /rooms sends createdBy from authenticated user', async () => {
      mockChatService.createRoom.mockReturnValue(of({ id: 'room-1' }));

      await request(app.getHttpServer())
        .post('/rooms')
        .send({ name: 'New Room' })
        .expect(201);

      expect(mockChatService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Room', createdBy: 'mod1' }),
      );
    });
  });

  describe('4.7.3 Create room validation', () => {
    it('POST /rooms rejects missing name', async () => {
      await request(app.getHttpServer())
        .post('/rooms')
        .send({})
        .expect(400);
    });
  });

  describe('4.7.4 Remove room', () => {
    it('DELETE /rooms/:roomId returns 200', async () => {
      mockChatService.removeRoom.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/rooms/room-1')
        .expect(200);

      expect(mockChatService.removeRoom).toHaveBeenCalledWith({ roomId: 'room-1' });
    });
  });

  describe('4.7.5 Update room schedule', () => {
    it('PATCH /rooms/:roomId/schedule updates fields', async () => {
      mockChatService.updateRoomSchedule.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/rooms/room-1/schedule')
        .send({ url: 'https://www.youtube.com/watch?v=abc123', time: '2026-06-01T10:00:00Z' })
        .expect(200);

      expect(mockChatService.updateRoomSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1' }),
      );
    });

    it('PATCH /rooms/:roomId/schedule accepts minimal fields', async () => {
      mockChatService.updateRoomSchedule.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/rooms/room-1/schedule')
        .send({ setUrlNull: true, setTimeNull: false })
        .expect(200);

      expect(mockChatService.updateRoomSchedule).toHaveBeenCalled();
    });
  });

  describe('4.7.6 Update room schedule invalid URL', () => {
    it('rejects non-YouTube/Twitch URLs', async () => {
      await request(app.getHttpServer())
        .patch('/rooms/room-1/schedule')
        .send({ url: 'https://example.com/stream' })
        .expect(400);
    });

    it('accepts Twitch URLs', async () => {
      mockChatService.updateRoomSchedule.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/rooms/room-1/schedule')
        .send({ url: 'https://www.twitch.tv/mystream' })
        .expect(200);
    });

    it('accepts youtu.be short URLs', async () => {
      mockChatService.updateRoomSchedule.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .patch('/rooms/room-1/schedule')
        .send({ url: 'https://youtu.be/abc123' })
        .expect(200);
    });
  });

  describe('4.7.7 Ban user from room', () => {
    it('POST /rooms/:roomId/ban returns 200', async () => {
      mockChatService.banUserFromRoom.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/rooms/room-1/ban')
        .send({ uid: 'user-1', reason: 'Spam' })
        .expect(201);

      expect(mockChatService.banUserFromRoom).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1', uid: 'user-1' }),
      );
    });

    it('POST /rooms/:roomId/ban works without reason', async () => {
      mockChatService.banUserFromRoom.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .post('/rooms/room-1/ban')
        .send({ uid: 'user-2' })
        .expect(201);
    });
  });

  describe('4.7.8 Ban user validation', () => {
    it('rejects ban without uid', async () => {
      await request(app.getHttpServer())
        .post('/rooms/room-1/ban')
        .send({ reason: 'No uid' })
        .expect(400);
    });

    it('rejects ban with empty body', async () => {
      await request(app.getHttpServer())
        .post('/rooms/room-1/ban')
        .send({})
        .expect(400);
    });
  });

  describe('4.7.9 Unban user', () => {
    it('DELETE /rooms/:roomId/ban/:uid returns 200', async () => {
      mockChatService.unbanUserFromRoom.mockReturnValue(of(undefined));

      await request(app.getHttpServer())
        .delete('/rooms/room-1/ban/user-1')
        .expect(200);

      expect(mockChatService.unbanUserFromRoom).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1', uid: 'user-1' }),
      );
    });
  });

  describe('4.7.10 Get chat log', () => {
    it('GET /rooms/:roomId/logs returns chat log', async () => {
      const mockLog = {
        chats: [{ id: 'msg-1', uid: 'user-1', message: 'Hello' }],
        nextCursor: null,
        prevCursor: null,
      };
      mockChatService.getChatLog.mockReturnValue(of(mockLog));

      const res = await request(app.getHttpServer())
        .get('/rooms/room-1/logs')
        .expect(200);

      expect(res.body.chats).toHaveLength(1);
      expect(res.body.chats[0].message).toBe('Hello');
    });

    it('GET /rooms/:roomId/logs supports query params', async () => {
      mockChatService.getChatLog.mockReturnValue(of({ chats: [], nextCursor: null, prevCursor: null }));

      await request(app.getHttpServer())
        .get('/rooms/room-1/logs?uid=user-1&cursor=abc&limit=50')
        .expect(200);

      expect(mockChatService.getChatLog).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1', uid: 'user-1', cursor: 'abc', limit: 50 }),
      );
    });
  });
});
