import { ChatService } from '../../services/chat.service';
import { BanUserDto } from '../dtos/req/ban-user.req.dto';
import { CreateRoomDto } from '../dtos/req/create-room.req.dto';
import { GetChatLogDto } from '../dtos/req/get-chat-log.req.dto';
import { GetRoomListDto } from '../dtos/req/get-room-list.req.dto';
import { RemoveRoomDto } from '../dtos/req/remove-room.req.dto';
import { UnbanUserDto } from '../dtos/req/unban-user.req.dto';
import { UpdateRoomDto } from '../dtos/req/update-room.req.dto';
import { ChatLogDto } from '../dtos/res/chat-log.res.dto';
import { RoomsDto } from '../dtos/res/rooms.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { live } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@live.ChatServiceControllerMethods()
@Controller()
export class ChatController implements live.ChatServiceController {
	constructor(private readonly chatService: ChatService) {}

	@SerializeOptions({ type: RoomsDto })
	async getRoomList(@Payload() request: GetRoomListDto): Promise<RoomsDto> {
		return this.chatService.getRoomList({
			cursor: request.cursor,
			limit: request.limit,
		});
	}

	@SerializeOptions({ type: ChatLogDto })
	async getChatLog(@Payload() request: GetChatLogDto): Promise<ChatLogDto> {
		return this.chatService.getChatLogsOf(request.roomId, {
			cursor: request.cursor,
			dateRange: request.dateRange,
			limit: request.limit,
			uid: request.uid,
		});
	}

	async createRoom(@Payload() request: CreateRoomDto): Promise<live.CreatedRoomResponse> {
		const roomId = await this.chatService.createRoom(request.name, request.createdBy);
		return { id: roomId };
	}

	async removeRoom(@Payload() request: RemoveRoomDto): Promise<void> {
		return this.chatService.removeRoom(request.roomId);
	}

	async banUserFromRoom(@Payload() request: BanUserDto): Promise<void> {
		return this.chatService.banUserFrom(request.roomId, request.uid, request.reason);
	}

	async unbanUserFromRoom(@Payload() request: UnbanUserDto): Promise<void> {
		return this.chatService.unbanUserFrom(request.roomId, request.uid);
	}

	async updateRoomSchedule(@Payload() request: UpdateRoomDto): Promise<void> {
		return this.chatService.updateRoomSchedule(request.roomId, {
			time: request.time,
			url: request.url,
			setTimeNull: request.setTimeNull,
			setUrlNull: request.setUrlNull,
		});
	}
}
