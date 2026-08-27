import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { LIVE_CLIENT } from './constants/live';
import { BanUserFromRoomDto } from './dtos/req/ban-user-from-room.req.dto';
import { CreateRoomDto } from './dtos/req/create-room.req.dto';
import { UpdateRoomScheduleDto } from './dtos/req/update-room-schedule.req.dto';
import { ChatLogDto } from './dtos/res/chat-log.dto';
import { RoomListDto } from './dtos/res/room.dto';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	OnModuleInit,
	Param,
	Patch,
	Post,
	Query,
	Req,
	SerializeOptions,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { live } from '@server/generated';
import { Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

const ALLOWED_LIVE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|twitch\.tv)\//i;

@ApiBearerAuth()
@ApiTags('Chat')
@Controller('rooms')
export class LiveGatewayController implements OnModuleInit {
	private chatService!: live.ChatServiceClient;

	constructor(@Inject(LIVE_CLIENT) private readonly liveClient: ClientGrpc) {}

	onModuleInit() {
		this.chatService = this.liveClient.getService<live.ChatServiceClient>(live.CHAT_SERVICE_NAME);
	}

	@Get()
	@ApiOperation({ summary: 'List chat rooms' })
	@ApiResponseEntity(RoomListDto)
	@SerializeOptions({ type: RoomListDto, strategy: 'exposeAll' })
	getRoomList(@Query('cursor') cursor?: string, @Query('limit') limit?: number) {
		return this.chatService.getRoomList({ cursor: cursor, limit: limit });
	}

	@Get(':roomId/logs')
	@ApiOperation({ summary: 'Get chat log for a room' })
	@ApiResponseEntity(ChatLogDto)
	@SerializeOptions({ type: ChatLogDto, strategy: 'exposeAll' })
	getChatLog(
		@Param('roomId') roomId: string,
		@Query('uid') uid?: string,
		@Query('cursor') cursor?: string,
		@Query('limit') limit?: number,
	) {
		return this.chatService.getChatLog({ roomId: roomId, uid: uid, cursor: cursor, limit: limit });
	}

	@Post()
	@HasRoles(Role.Mod, Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Create a chat room' })
	createRoom(@Req() req: AuthenticatedRequest, @Body() body: CreateRoomDto) {
		return this.chatService.createRoom({ ...body, createdBy: req.user.sub });
	}

	@Delete(':roomId')
	@HasRoles(Role.Mod, Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove a chat room' })
	@ResourceAccess({
		resourceType: 'room',
		resourceIdParam: 'roomId',
		rules: [{ roles: [Role.Admin] }, { roles: [Role.Mod], requireOwnership: true }],
	})
	removeRoom(@Param('roomId') roomId: string) {
		return this.chatService.removeRoom({ roomId: roomId });
	}

	@Patch(':roomId/schedule')
	@HasRoles(Role.Mod, Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Update room schedule' })
	@ResourceAccess({
		resourceType: 'room',
		resourceIdParam: 'roomId',
		rules: [{ roles: [Role.Admin] }, { roles: [Role.Mod], requireOwnership: true }],
	})
	updateRoomSchedule(@Param('roomId') roomId: string, @Body() body: UpdateRoomScheduleDto) {
		if (body.url && !ALLOWED_LIVE_URL_PATTERN.test(body.url)) {
			throw new BadRequestException('Only YouTube and Twitch URLs are allowed');
		}
		return this.chatService.updateRoomSchedule({
			...body,
			roomId: roomId,
		} as live.UpdateRoomScheduleRequest);
	}

	@Post(':roomId/ban')
	@HasRoles(Role.Mod, Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Ban a user from a room' })
	banUserFromRoom(@Param('roomId') roomId: string, @Body() body: BanUserFromRoomDto) {
		return this.chatService.banUserFromRoom({ ...body, roomId: roomId });
	}

	@Delete(':roomId/ban/:uid')
	@HasRoles(Role.Mod, Role.Admin)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Unban a user from a room' })
	unbanUserFromRoom(@Param('roomId') roomId: string, @Param('uid') uid: string) {
		return this.chatService.unbanUserFromRoom({ uid: uid, roomId: roomId });
	}
}
