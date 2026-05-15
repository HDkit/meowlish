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
	UsePipes,
} from '@nestjs/common';
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
import { GlobalValidationPipe, GlobalWsExceptionFilter } from '@server/utils';
import { Server, Socket } from 'socket.io';

type ModifiedSocket = Omit<Socket, 'data'> & { data: { uid: string } };

// cannot register using APP_FILTER, APP_PIPE
@UsePipes(GlobalValidationPipe)
@UseFilters(GlobalWsExceptionFilter)
@WebSocketGateway({
	cors: {
		origin: '*',
	},
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	constructor(
		private logger: AppLoggerService,
		@Inject(IRoomRepositoryToken) private readonly roomRepository: IRoomRepository,
	) {}

	@WebSocketServer()
	server!: Server;

	async handleConnection(socket: ModifiedSocket) {
		try {
			if (!socket.handshake.headers.authorization) throw new Error('Missing authorization header');
			socket.data.uid = socket.handshake.headers.authorization;
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
	async handleJoin(@MessageBody() roomId: string, @ConnectedSocket() socket: ModifiedSocket) {
		if (!(await this.roomRepository.canJoinRoom(roomId, socket.data.uid)))
			throw new UnauthorizedException('User is not allowed to join this room');
		await socket.join(roomId);
	}

	@SubscribeMessage('leave-room')
	async handleLeave(@MessageBody() roomId: string, @ConnectedSocket() socket: ModifiedSocket) {
		await socket.leave(roomId);
	}

	@SubscribeMessage('chat')
	handlePing(@MessageBody() data: ChatDto, @ConnectedSocket() socket: ModifiedSocket): void {
		if (!socket.rooms.has(data.roomId))
			throw new ForbiddenException('You need to join the room before sending a message');
		socket.to(data.roomId).emit('message', { message: data.message, uid: socket.data.uid });
	}

	disconnectUser(uid: string, roomId: string) {
		this.server.in(uid).socketsLeave(roomId);
	}
}
