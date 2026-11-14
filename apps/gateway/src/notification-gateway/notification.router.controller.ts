import { HasRoles } from '../auth/decorators/roles.decorator';
import { SkipAllThrottlers } from '../throttle';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { NOTIFICATION_CLIENT } from './constants/notification';
import { CreateNotificationDto } from './dtos/req/create-notification.req.dto';
import { ListNotificationsQueryDto } from './dtos/req/list-notifications.query.dto';
import { UpdatePreferencesReqDto } from './dtos/req/update-preferences.req.dto';
import { NotificationPreferencesDto } from './dtos/res/notification-preferences.res.dto';
import { NotificationDto, NotificationListDto } from './dtos/res/notification.dto';
import {
	All,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Inject,
	Next,
	OnModuleInit,
	Param,
	Patch,
	Post,
	Query,
	Req,
	Res,
	SerializeOptions,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { notification } from '@server/generated';
import { Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';
import { NextFunction, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

@ApiBearerAuth()
@ApiTags('Notifications')
@Controller()
export class NotificationGatewayController implements OnModuleInit {
	private notificationService!: notification.NotificationServiceClient;
	private notificationPreferencesService!: notification.NotificationPreferencesServiceClient;

	private sseProxy = createProxyMiddleware({
		target:
			process.env.NOTIFICATION_SERVICE_SSE_URL ??
			`http://${process.env.NOTIFICATION_SERVICE_HOST}:${process.env.NOTIFICATION_SERVICE_HTTP_PORT ?? 50061}`,
		changeOrigin: true,
		pathRewrite: {
			'^/api/v1/notifications/stream': '/notifications/stream',
		},
	});

	constructor(@Inject(NOTIFICATION_CLIENT) private readonly notificationClient: ClientGrpc) {}

	onModuleInit() {
		this.notificationService =
			this.notificationClient.getService<notification.NotificationServiceClient>(
				notification.NOTIFICATION_SERVICE_NAME,
			);
		this.notificationPreferencesService =
			this.notificationClient.getService<notification.NotificationPreferencesServiceClient>(
				notification.NOTIFICATION_PREFERENCES_SERVICE_NAME,
			);
	}

	@All('stream/:recipientId')
	@ApiOperation({ summary: 'SSE stream for notifications' })
	@SkipAllThrottlers()
	async streamNotifications(
		@Param('recipientId') recipientId: string,
		@Req() req: AuthenticatedRequest,
		@Res() res: Response,
		@Next() next: NextFunction,
	) {
		// The notification service streams whatever recipient is in the path, so only allow your own.
		if (recipientId !== req.user.sub) {
			throw new ForbiddenException('You can only subscribe to your own notifications');
		}
		await this.sseProxy(req, res, next);
	}

	@Post()
	@HasRoles(Role.Admin)
	@ApiOperation({ summary: 'Create a notification (admins)' })
	@ApiResponseEntity(NotificationDto)
	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	createNotification(@Body() body: CreateNotificationDto) {
		return this.notificationService.createNotification(body);
	}

	// Declared before `:id` routes so `preferences` is never captured as an id.
	@Get('preferences')
	@ApiOperation({ summary: 'Get my notification preferences' })
	@ApiResponseEntity(NotificationPreferencesDto)
	@SerializeOptions({ type: NotificationPreferencesDto, strategy: 'exposeAll' })
	getPreferences(@Req() req: AuthenticatedRequest) {
		return this.notificationPreferencesService.getPreferences({ identityId: req.user.sub });
	}

	@Patch('preferences')
	@ApiOperation({ summary: 'Update my notification preferences' })
	@ApiResponseEntity(NotificationPreferencesDto)
	@SerializeOptions({ type: NotificationPreferencesDto, strategy: 'exposeAll' })
	updatePreferences(@Req() req: AuthenticatedRequest, @Body() body: UpdatePreferencesReqDto) {
		return this.notificationPreferencesService.updatePreferences({
			emailEnabled: body.emailEnabled,
			pushEnabled: body.pushEnabled,
			achievementEnabled: body.achievementEnabled,
			reportEnabled: body.reportEnabled,
			systemEnabled: body.systemEnabled,
			blogCommentEnabled: body.blogCommentEnabled,
			commentReplyEnabled: body.commentReplyEnabled,
			forumReplyEnabled: body.forumReplyEnabled,
			identityId: req.user.sub,
		});
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a notification by ID' })
	@ApiResponseEntity(NotificationDto)
	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	getNotification(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.notificationService.getNotification({ id: id, recipientId: req.user.sub });
	}

	@Delete(':id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a notification' })
	deleteNotification(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.notificationService.deleteNotification({ id: id, recipientId: req.user.sub });
	}

	@Get()
	@ApiOperation({ summary: 'List notifications' })
	@ApiResponseEntity(NotificationListDto)
	@SerializeOptions({ type: NotificationListDto, strategy: 'exposeAll' })
	listNotifications(@Req() req: AuthenticatedRequest, @Query() query: ListNotificationsQueryDto) {
		return this.notificationService.listNotifications({ ...query, recipientId: req.user.sub });
	}

	@Patch(':id/read')
	@ApiOperation({ summary: 'Mark a notification as read' })
	@ApiResponseEntity(NotificationDto)
	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.notificationService.markAsRead({ id: id, recipientId: req.user.sub });
	}

	@Post('read-all')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Mark all notifications as read' })
	markAllAsRead(@Req() req: AuthenticatedRequest) {
		return this.notificationService.markAllAsRead({ recipientId: req.user.sub });
	}
}
