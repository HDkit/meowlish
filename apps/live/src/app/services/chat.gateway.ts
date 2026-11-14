import { type IEnvVars } from '../../configs/config';
import { AUTH_CLIENT } from '../../constants/auth';
import {
	type IRoomRepository,
	IRoomRepositoryToken,
} from '../../domain/repositories/room.repository';
import { ChatDto } from '../presentation/dtos/req/chat.req.dto';
import { type OnModuleInit } from '@nestjs/common';
import {
	ForbiddenException,
	Inject,
	UnauthorizedException,
	UseFilters,
	UseGuards,
	UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { auth } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import {
	GlobalValidationPipe,
	GlobalWsExceptionFilter,
	isAccessTokenPayload,
	readCookie,
} from '@server/utils';
import { isUUID } from 'class-validator';
import jwt from 'jsonwebtoken';
import { ClsGuard } from 'nestjs-cls';
import { lastValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

type ModifiedSocket = Omit<Socket, 'data'> & { data: { uid: string } };

// cannot register using APP_FILTER, APP_PIPE
@UseGuards(ClsGuard)
@UsePipes(GlobalValidationPipe)
@UseFilters(GlobalWsExceptionFilter)
// CORS is set from CORS_ORIGINS in RedisIoAdapter (gateway options are static)
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
	private readonly jwtPublicKey?: string;
	private authService!: auth.AuthServiceClient;

	constructor(
		private logger: AppLoggerService,
		@Inject(IRoomRepositoryToken) private readonly roomRepository: IRoomRepository,
		configService: ConfigService<IEnvVars>,
		@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc,
	) {
		this.jwtPublicKey = configService.get('jwtPublicKey', { infer: true });
		if (!this.jwtPublicKey) {
			this.logger.warn('JWT_PUBLIC_KEY is not set: every socket connection will be rejected');
		}
	}

	/**
	 * Token from the `access_token` cookie (browser session, same order as the gateway: cookie
	 * before anything the client passes explicitly), then socket.io `auth`, `?token=`, or
	 * `Authorization: Bearer`.
	 */
	private extractToken(socket: ModifiedSocket): string | undefined {
		const cookie = readCookie(socket.handshake.headers.cookie, 'access_token');
		if (cookie) return cookie;
		const auth = socket.handshake.auth as { token?: unknown } | undefined;
		if (typeof auth?.token === 'string') return auth.token;
		const query = socket.handshake.query.token;
		if (typeof query === 'string') return query;
		const header = socket.handshake.headers.authorization;
		return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
	}

	@WebSocketServer()
	server!: Server;

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	/**
	 * The user id must come from a verified access token. This service is reachable directly (Envoy),
	 * so it can't trust anything the gateway or client puts in headers.
	 */
	async handleConnection(socket: ModifiedSocket) {
		try {
			const token = this.extractToken(socket);
			if (!token || !this.jwtPublicKey) throw new Error('Missing token');
			const payload = jwt.verify(token, this.jwtPublicKey, { algorithms: ['RS256'] });
			if (
				typeof payload === 'string' ||
				typeof payload.sub !== 'string' ||
				// a refresh token is signed with the same key but must not open sockets
				!isAccessTokenPayload(payload)
			) {
				throw new Error('Invalid token payload');
			}
			// A valid signature is not enough: the token may have been revoked (logout-all, password
			// change) or the account locked. Same check as the gateway; any failure refuses the socket.
			await lastValueFrom(
				this.authService.validateAccess({
					identityId: payload.sub,
					iat: typeof payload.iat === 'number' ? payload.iat : 0,
					iatMs: typeof payload.iatMs === 'number' ? payload.iatMs : undefined,
				}),
			);
			socket.data.uid = payload.sub;
			await socket.join(socket.data.uid);
		} catch {
			socket.disconnect(true);
		}
	}

	handleDisconnect(socket: ModifiedSocket) {
		try {
			this.logger.debug(`Client disconnected: ${socket.id}`);
		} catch {
			socket.disconnect(true);
		}
	}

	@SubscribeMessage('join-room')
	async handleJoin(@MessageBody() roomId: unknown, @ConnectedSocket() socket: ModifiedSocket) {
		// Room ids are UUIDs; anything else (e.g. another user's private uid room) is refused.
		if (typeof roomId !== 'string' || !isUUID(roomId)) {
			throw new UnauthorizedException('User is not allowed to join this room');
		}
		let allowed = false;
		try {
			allowed = await this.roomRepository.canJoinRoom(roomId, socket.data.uid);
		} catch (e) {
			// Fail closed: an error must never let a banned user in.
			this.logger.error(
				`[ChatGateway] canJoinRoom failed for room=${roomId} uid=${socket.data.uid}`,
				'',
				e instanceof Error ? e.stack : String(e),
			);
		}
		if (!allowed) throw new UnauthorizedException('User is not allowed to join this room');
		await socket.join(roomId);
	}

	@SubscribeMessage('leave-room')
	async handleLeave(@MessageBody() roomId: unknown, @ConnectedSocket() socket: ModifiedSocket) {
		// Only chat rooms (UUIDs). Leaving one's own uid room would hide the socket from ban kicks
		// and private pushes.
		if (typeof roomId !== 'string' || !isUUID(roomId)) {
			throw new UnauthorizedException('User is not allowed to leave this room');
		}
		await socket.leave(roomId);
	}

	/**
	 * Saves and broadcasts a message to the room's other sockets. Returns the stored message as the
	 * socket.io acknowledgement, so the sender can replace its optimistic copy with the real one
	 * (same id as in the chat log) instead of showing it twice.
	 */
	@SubscribeMessage('chat')
	async handlePing(
		@MessageBody() data: ChatDto,
		@ConnectedSocket() socket: ModifiedSocket,
	): Promise<{ id: string; createdAt: string }> {
		if (!socket.rooms.has(data.roomId))
			throw new ForbiddenException('You need to join the room before sending a message');
		const log = await this.roomRepository.saveLog(data.roomId, socket.data.uid, data.message);
		const createdAt = log.createdAt.toISOString();
		socket.to(data.roomId).emit('message', {
			id: log.id,
			fromId: socket.data.uid,
			message: data.message,
			createdAt: createdAt,
		});
		return { id: log.id, createdAt: createdAt };
	}

	/**
	 * Removes every socket of `uid` from `roomId` (a ban). Sockets are found by the uid verified at
	 * connect (`socket.data.uid`, shared through the Redis adapter), not through the user's uid room,
	 * which a client could have left.
	 */
	async disconnectUser(uid: string, roomId: string): Promise<void> {
		this.server.in(uid).socketsLeave(roomId);
		const sockets = await this.server.in(roomId).fetchSockets();
		for (const socket of sockets) {
			const data: unknown = socket.data;
			if (typeof data === 'object' && data !== null && 'uid' in data && data.uid === uid) {
				socket.leave(roomId);
			}
		}
	}

	/** Disconnects every socket of `uid` on every node (account locked). */
	async disconnectAllOf(uid: string): Promise<void> {
		this.server.in(uid).disconnectSockets(true);
		// also sockets that somehow left their uid room
		for (const socket of await this.server.fetchSockets()) {
			const data: unknown = socket.data;
			if (typeof data === 'object' && data !== null && 'uid' in data && data.uid === uid) {
				socket.disconnect(true);
			}
		}
	}

	/** Removes every socket from a room (e.g. after it is deleted). */
	closeRoom(roomId: string) {
		this.server.in(roomId).socketsLeave(roomId);
	}
}
