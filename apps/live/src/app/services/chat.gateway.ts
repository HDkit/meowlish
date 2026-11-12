import { type IEnvVars } from '../../configs/config';
import {
	type IRoomRepository,
	IRoomRepositoryToken,
} from '../../domain/repositories/room.repository';
import { ChatDto } from '../presentation/dtos/req/chat.req.dto';
import {
	ForbiddenException,
	Inject,
	UnauthorizedException,
	UseFilters,
	UseGuards,
	UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, GlobalWsExceptionFilter, readCookie } from '@server/utils';
import { isUUID } from 'class-validator';
import jwt from 'jsonwebtoken';
import { ClsGuard } from 'nestjs-cls';
import { Server, Socket } from 'socket.io';

type ModifiedSocket = Omit<Socket, 'data'> & { data: { uid: string } };

// cannot register using APP_FILTER, APP_PIPE
@UseGuards(ClsGuard)
@UsePipes(GlobalValidationPipe)
@UseFilters(GlobalWsExceptionFilter)
// CORS is set from CORS_ORIGINS in RedisIoAdapter (gateway options are static)
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly jwtPublicKey?: string;

	constructor(
		private logger: AppLoggerService,
		@Inject(IRoomRepositoryToken) private readonly roomRepository: IRoomRepository,
		configService: ConfigService<IEnvVars>,
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

	/**
	 * The user id must come from a verified access token. This service is reachable directly (Envoy),
	 * so it can't trust anything the gateway or client puts in headers.
	 */
	async handleConnection(socket: ModifiedSocket) {
		try {
			const token = this.extractToken(socket);
			if (!token || !this.jwtPublicKey) throw new Error('Missing token');
			const payload = jwt.verify(token, this.jwtPublicKey, { algorithms: ['RS256'] });
			if (typeof payload === 'string' || typeof payload.sub !== 'string') {
				throw new Error('Invalid token payload');
			}
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
	async handleLeave(@MessageBody() roomId: string, @ConnectedSocket() socket: ModifiedSocket) {
		await socket.leave(roomId);
	}

	@SubscribeMessage('chat')
	async handlePing(
		@MessageBody() data: ChatDto,
		@ConnectedSocket() socket: ModifiedSocket,
	): Promise<void> {
		if (!socket.rooms.has(data.roomId))
			throw new ForbiddenException('You need to join the room before sending a message');
		const log = await this.roomRepository.saveLog(data.roomId, socket.data.uid, data.message);
		socket.to(data.roomId).emit('message', {
			id: log.id,
			fromId: socket.data.uid,
			message: data.message,
			createdAt: log.createdAt.toISOString(),
		});
	}

	disconnectUser(uid: string, roomId: string) {
		this.server.in(uid).socketsLeave(roomId);
	}

	/** Removes every socket from a room (e.g. after it is deleted). */
	closeRoom(roomId: string) {
		this.server.in(roomId).socketsLeave(roomId);
	}
}
