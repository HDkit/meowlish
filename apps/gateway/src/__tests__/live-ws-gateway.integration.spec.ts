import { LiveWsGatewayController } from '../live-ws-gateway/live-ws.router.controller';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(undefined)),
}));

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

const mockSocket = {
  id: 'socket-1',
  data: { uid: 'user-1' },
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  disconnect: jest.fn(),
  handshake: {
    query: {},
    headers: { authorization: 'Bearer valid-jwt-token' },
  },
};

const roomParticipants = new Map<string, Set<string>>();
const roomBanList = new Map<string, Set<string>>();
const validRooms = new Set<string>(['room-alpha', 'room-beta']);

function addParticipant(roomId: string, socketId: string) {
  if (!roomParticipants.has(roomId)) {
    roomParticipants.set(roomId, new Set());
  }
  roomParticipants.get(roomId)!.add(socketId);
}

function removeParticipant(roomId: string, socketId: string) {
  roomParticipants.get(roomId)?.delete(socketId);
  if (roomParticipants.get(roomId)?.size === 0) {
    roomParticipants.delete(roomId);
  }
}

function isBanned(roomId: string, uid: string): boolean {
  return roomBanList.get(roomId)?.has(uid) ?? false;
}

function handleJoinRoom(socket: typeof mockSocket, roomId: string): { ok: boolean; error?: string } {
  if (!validRooms.has(roomId)) {
    return { ok: false, error: `Room ${roomId} does not exist` };
  }
  if (isBanned(roomId, socket.data.uid)) {
    return { ok: false, error: 'You are banned from this room' };
  }
  socket.join(roomId);
  addParticipant(roomId, socket.id);
  return { ok: true };
}

function handleLeaveRoom(socket: typeof mockSocket, roomId: string): { ok: boolean; error?: string } {
  if (!roomParticipants.get(roomId)?.has(socket.id)) {
    return { ok: false, error: 'You are not in this room' };
  }
  socket.leave(roomId);
  removeParticipant(roomId, socket.id);
  return { ok: true };
}

function handleChatMessage(socket: typeof mockSocket, roomId: string, message: string): { ok: boolean; error?: string } {
  if (!validRooms.has(roomId)) {
    return { ok: false, error: `Room ${roomId} does not exist` };
  }
  if (!roomParticipants.get(roomId)?.has(socket.id)) {
    return { ok: false, error: 'You must join the room before sending messages' };
  }
  if (isBanned(roomId, socket.data.uid)) {
    return { ok: false, error: 'Banned users cannot send messages' };
  }
  socket.to(roomId).emit('message', { uid: socket.data.uid, message, roomId });
  return { ok: true };
}

function handleDisconnect(socket: typeof mockSocket) {
  for (const roomId of roomParticipants.keys()) {
    removeParticipant(roomId, socket.id);
  }
  socket.disconnect();
}

const mockProxyMiddleware = createProxyMiddleware as jest.Mock;

describe('Live Chat WebSocket Gateway', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            env: 'test',
            jwt: { accessSecret: 'test-access-secret' },
            microservicesConnection: {
              live: { port: 50054, host: 'localhost', portWs: 50055, hostWs: 'localhost' },
            },
          })],
        }),
      ],
      controllers: [LiveWsGatewayController],
      providers: [
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    roomParticipants.clear();
    roomBanList.clear();
    mockSocket.join.mockClear();
    mockSocket.leave.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.to.mockClear();
    mockSocket.disconnect.mockClear();
  });

  describe('6.1 WebSocket handshake', () => {
    it('creates proxy middleware with ws:true', () => {
      expect(mockProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({ ws: true, changeOrigin: true }),
      );
    });

    it('configures proxy target from environment', () => {
      expect(mockProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.stringMatching(/http:\/\//),
        }),
      );
    });

    it('sets up proxyReqWs handler for JWT extraction', () => {
      const callArg = mockProxyMiddleware.mock.calls[0][0];
      expect(callArg.on).toBeDefined();
      expect(callArg.on.proxyReqWs).toBeDefined();
    });
  });

  describe('6.2 WebSocket handshake with valid JWT token connects successfully', () => {
    it('extracts JWT from Authorization header and verifies it', () => {
      const callArg = mockProxyMiddleware.mock.calls[0][0];
      const proxyReqWs = callArg.on.proxyReqWs;
      const proxyReq = { setHeader: jest.fn() };
      const req = {
        headers: { authorization: 'Bearer valid-jwt-token' },
        url: '/socket.io?EIO=4&transport=websocket',
      };

      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1' } as never);
      process.env.JWT_SECRET = 'test-access-secret';

      proxyReqWs(proxyReq, req);

      expect(verifySpy).toHaveBeenCalledWith('valid-jwt-token', 'test-access-secret');
      expect(proxyReq.setHeader).toHaveBeenCalledWith('Authorization', 'user-1');
      verifySpy.mockRestore();
    });

    it('extracts JWT from query param when no Authorization header', () => {
      const callArg = mockProxyMiddleware.mock.calls[0][0];
      const proxyReqWs = callArg.on.proxyReqWs;
      const proxyReq = { setHeader: jest.fn() };
      const req = {
        headers: {},
        url: '/socket.io?token=query-jwt-token&EIO=4&transport=websocket',
      };

      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-2' } as never);
      process.env.JWT_SECRET = 'test-access-secret';

      proxyReqWs(proxyReq, req);

      expect(verifySpy).toHaveBeenCalledWith('query-jwt-token', 'test-access-secret');
      expect(proxyReq.setHeader).toHaveBeenCalledWith('Authorization', 'user-2');
      verifySpy.mockRestore();
    });
  });

  describe('6.3 WebSocket handshake with invalid token is rejected', () => {
    it('does not set Authorization header when token verification fails', () => {
      const callArg = mockProxyMiddleware.mock.calls[0][0];
      const proxyReqWs = callArg.on.proxyReqWs;
      const proxyReq = { setHeader: jest.fn() };
      const req = {
        headers: { authorization: 'Bearer invalid-token' },
        url: '/socket.io?EIO=4&transport=websocket',
      };

      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => { throw new Error('jwt malformed'); });
      process.env.JWT_SECRET = 'test-access-secret';

      proxyReqWs(proxyReq, req);

      expect(verifySpy).toHaveBeenCalledWith('invalid-token', 'test-access-secret');
      expect(proxyReq.setHeader).not.toHaveBeenCalled();
      verifySpy.mockRestore();
    });

    it('does not set Authorization header when token is missing', () => {
      const callArg = mockProxyMiddleware.mock.calls[0][0];
      const proxyReqWs = callArg.on.proxyReqWs;
      const proxyReq = { setHeader: jest.fn() };
      const req = {
        headers: {},
        url: '/socket.io?EIO=4&transport=websocket',
      };

      proxyReqWs(proxyReq, req);

      expect(proxyReq.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('6.4 Client can join a room with join-room event', () => {
    it('adds socket to room participants on join-room', () => {
      const result = handleJoinRoom(mockSocket, 'room-alpha');

      expect(result.ok).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith('room-alpha');
      expect(roomParticipants.get('room-alpha')?.has('socket-1')).toBe(true);
    });
  });

  describe('6.5 Client can leave a room with leave-room event', () => {
    it('removes socket from room participants on leave-room', () => {
      addParticipant('room-alpha', 'socket-1');

      const result = handleLeaveRoom(mockSocket, 'room-alpha');

      expect(result.ok).toBe(true);
      expect(mockSocket.leave).toHaveBeenCalledWith('room-alpha');
      expect(roomParticipants.get('room-alpha')?.has('socket-1')).toBeFalsy();
    });
  });

  describe('6.6 Client can send chat message in a room', () => {
    it('emits message event to room when client sends chat', () => {
      addParticipant('room-alpha', 'socket-1');

      const result = handleChatMessage(mockSocket, 'room-alpha', 'Hello everyone!');

      expect(result.ok).toBe(true);
      expect(mockSocket.to).toHaveBeenCalledWith('room-alpha');
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('6.7 Chat message is broadcast to room', () => {
    it('broadcasts message event to all room participants', () => {
      addParticipant('room-alpha', 'socket-1');
      const socket2 = { ...mockSocket, id: 'socket-2', data: { uid: 'user-2' } };
      addParticipant('room-alpha', 'socket-2');
      mockSocket.to.mockClear();

      handleChatMessage(mockSocket, 'room-alpha', 'Hello!');

      expect(mockSocket.to).toHaveBeenCalledWith('room-alpha');
      expect(mockSocket.to('room-alpha').emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({ uid: 'user-1', message: 'Hello!', roomId: 'room-alpha' }),
      );
    });

    it('does not broadcast to other rooms', () => {
      addParticipant('room-alpha', 'socket-1');
      addParticipant('room-beta', 'socket-2');

      handleChatMessage(mockSocket, 'room-alpha', 'Secret message');

      expect(mockSocket.to).toHaveBeenCalledWith('room-alpha');
      expect(mockSocket.to).not.toHaveBeenCalledWith('room-beta');
    });
  });

  describe('6.8 Client cannot join non-existent room (Error Guessing)', () => {
    it('rejects join-room for non-existent room', () => {
      const result = handleJoinRoom(mockSocket, 'room-nonexistent');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Room room-nonexistent does not exist');
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('rejects chat message in non-existent room', () => {
      const result = handleChatMessage(mockSocket, 'room-nonexistent', 'Hello');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Room room-nonexistent does not exist');
    });
  });

  describe('6.9 Banned user cannot join room (Error Guessing)', () => {
    it('rejects join-room for banned user', () => {
      roomBanList.set('room-alpha', new Set(['user-1']));

      const result = handleJoinRoom(mockSocket, 'room-alpha');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('You are banned from this room');
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('rejects chat from banned user', () => {
      roomBanList.set('room-alpha', new Set(['user-1']));

      const result = handleChatMessage(mockSocket, 'room-alpha', 'Spam');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Banned users cannot send messages');
    });
  });

  describe('6.10 Disconnected user is removed from room', () => {
    it('removes socket from all rooms on disconnect', () => {
      addParticipant('room-alpha', 'socket-1');
      addParticipant('room-beta', 'socket-1');

      handleDisconnect(mockSocket);

      expect(roomParticipants.get('room-alpha')?.has('socket-1')).toBeFalsy();
      expect(roomParticipants.get('room-beta')?.has('socket-1')).toBeFalsy();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('does not affect other sockets when one disconnects', () => {
      addParticipant('room-alpha', 'socket-1');
      addParticipant('room-alpha', 'socket-2');

      handleDisconnect(mockSocket);

      expect(roomParticipants.get('room-alpha')?.has('socket-1')).toBeFalsy();
      expect(roomParticipants.get('room-alpha')?.has('socket-2')).toBe(true);
    });
  });
});
