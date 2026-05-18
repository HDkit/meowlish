import { type AuthenticatedRequest } from '../types/authenticated-request';
import { NOTIFICATION_CLIENT } from './constants/notification';
import { NotificationDto, NotificationListDto } from './dtos/res/notification.dto';
import { CreateNotificationDto } from './dtos/req/create-notification.req.dto';
import {
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
	All,
	Req,
	Res,
	Next,
	SerializeOptions,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { notification } from '@server/generated';
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
	async streamNotifications(
		@Param('recipientId') _recipientId: string,
		@Req() req: AuthenticatedRequest,
		@Res() res: Response,
		@Next() next: NextFunction,
	) {
		await this.sseProxy(req, res, next);
	}

	@Post()
	@ApiOperation({ summary: 'Create a notification' })
	createNotification(@Body() body: CreateNotificationDto) {
		return this.notificationService.createNotification(body);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a notification by ID' })
	@ApiResponseEntity(NotificationDto)
	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	getNotification(@Param('id') id: string) {
		return this.notificationService.getNotification({ id });
	}

	@Delete(':id')
	@ApiOperation({ summary: 'Delete a notification' })
	@ApiEmptyResponseEntity()
	deleteNotification(@Param('id') id: string) {
		return this.notificationService.deleteNotification({ id });
	}

	@Get()
	@ApiOperation({ summary: 'List notifications' })
	@ApiResponseEntity(NotificationListDto)
	@SerializeOptions({ type: NotificationListDto, strategy: 'exposeAll' })
	listNotifications(
		@Req() req: AuthenticatedRequest,
		@Query('type') type?: string,
		@Query('isRead') isRead?: boolean,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.notificationService.listNotifications({ recipientId: req.user.sub, type, isRead, page, limit });
	}

	@Patch(':id/read')
	@ApiOperation({ summary: 'Mark a notification as read' })
	markAsRead(@Param('id') id: string) {
		return this.notificationService.markAsRead({ id });
	}

	@Post('read-all')
	@ApiOperation({ summary: 'Mark all notifications as read' })
	@ApiEmptyResponseEntity()
	markAllAsRead(@Req() req: AuthenticatedRequest) {
		return this.notificationService.markAllAsRead({ recipientId: req.user.sub });
	}
}
