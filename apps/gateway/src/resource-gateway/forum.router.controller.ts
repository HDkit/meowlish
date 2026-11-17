import { HasRoles } from '../auth/decorators/roles.decorator';
import { requesterOf } from '../auth/functions/requester';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { RESOURCE_CLIENT } from './constants/resource';
import { CreateForumReplyDto } from './dtos/req/forum/create-forum-reply.req.dto';
import { CreateForumThreadDto } from './dtos/req/forum/create-forum-thread.req.dto';
import { ListForumThreadsQueryDto } from './dtos/req/forum/list-forum-threads.query.dto';
import { ModerateForumThreadDto } from './dtos/req/forum/moderate-forum-thread.req.dto';
import { UpdateForumReplyDto } from './dtos/req/forum/update-forum-reply.req.dto';
import { UpdateForumThreadDto } from './dtos/req/forum/update-forum-thread.req.dto';
import { PageQueryDto } from './dtos/req/page.query.dto';
import {
	ForumCategoryDto,
	ForumReplyDto,
	ForumThreadDto,
	ListForumCategoriesDto,
	ListForumRepliesDto,
	ListForumThreadsDto,
} from './dtos/res/forum.dto';
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
	Req,
	SerializeOptions,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

/** Forum moderators: pin/lock, delete anything, post in announcement categories and locked threads. */
const FORUM_MODERATOR_ROLES = [Role.Mod, Role.Admin] as const;

/**
 * Forum routes (`/resources/forum/...`). The resource service decides ownership and moderation
 * from the forwarded requester; the role gate on moderation only documents and short-circuits it.
 */
@ApiBearerAuth()
@ApiTags('Forum')
@Controller('forum')
export class ForumGatewayController implements OnModuleInit {
	private forumService!: resource.ForumServiceClient;

	constructor(@Inject(RESOURCE_CLIENT) private readonly resourceClient: ClientGrpc) {}

	onModuleInit() {
		this.forumService = this.resourceClient.getService<resource.ForumServiceClient>(
			resource.FORUM_SERVICE_NAME,
		);
	}

	// ── Categories ───────────────────────────────────────────────────────────

	@Get('categories')
	@ApiOperation({ summary: 'List forum categories with thread/reply totals and latest thread' })
	@ApiResponseEntity(ListForumCategoriesDto)
	@SerializeOptions({ type: ListForumCategoriesDto, strategy: 'exposeAll' })
	listCategories() {
		return this.forumService.listForumCategories({});
	}

	@Get('categories/:categoryId')
	@ApiOperation({ summary: 'Get a forum category' })
	@ApiResponseEntity(ForumCategoryDto)
	@SerializeOptions({ type: ForumCategoryDto, strategy: 'exposeAll' })
	getCategory(@Param('categoryId') categoryId: string) {
		return this.forumService.getForumCategory({ id: categoryId });
	}

	@Get('categories/:categoryId/threads')
	@ApiOperation({ summary: 'List threads of a category (pinned first, then latest activity)' })
	@ApiResponseEntity(ListForumThreadsDto)
	@SerializeOptions({ type: ListForumThreadsDto, strategy: 'exposeAll' })
	listThreads(@Param('categoryId') categoryId: string, @Query() query: ListForumThreadsQueryDto) {
		return this.forumService.listForumThreads({ ...query, categoryId: categoryId });
	}

	@Post('categories/:categoryId/threads')
	@ApiOperation({ summary: 'Open a thread (moderators only in moderators-only categories)' })
	@ApiResponseEntity(ForumThreadDto)
	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	createThread(
		@Req() req: AuthenticatedRequest,
		@Param('categoryId') categoryId: string,
		@Body() body: CreateForumThreadDto,
	) {
		return this.forumService.createForumThread({
			...body,
			categoryId: categoryId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	// ── Threads ──────────────────────────────────────────────────────────────

	@Get('threads/:threadId')
	@ApiOperation({ summary: 'Get a thread by ID or slug (counts a view)' })
	@ApiResponseEntity(ForumThreadDto)
	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	getThread(@Param('threadId') threadId: string) {
		return this.forumService.getForumThread({ id: threadId });
	}

	@Patch('threads/:threadId')
	@ApiOperation({ summary: 'Edit your own thread' })
	@ApiResponseEntity(ForumThreadDto)
	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	updateThread(
		@Req() req: AuthenticatedRequest,
		@Param('threadId') threadId: string,
		@Body() body: UpdateForumThreadDto,
	) {
		return this.forumService.updateForumThread({
			...body,
			id: threadId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	@Patch('threads/:threadId/moderation')
	@HasRoles(...FORUM_MODERATOR_ROLES)
	@ApiOperation({ summary: 'Pin/unpin or lock/unlock a thread (moderators)' })
	@ApiResponseEntity(ForumThreadDto)
	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	moderateThread(
		@Req() req: AuthenticatedRequest,
		@Param('threadId') threadId: string,
		@Body() body: ModerateForumThreadDto,
	) {
		return this.forumService.moderateForumThread({
			...body,
			id: threadId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	@Delete('threads/:threadId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a thread and its replies (author or moderators)' })
	deleteThread(@Req() req: AuthenticatedRequest, @Param('threadId') threadId: string) {
		return this.forumService.deleteForumThread({
			id: threadId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	// ── Replies ──────────────────────────────────────────────────────────────

	@Get('threads/:threadId/replies')
	@ApiOperation({ summary: 'List replies of a thread (ID or slug), oldest first' })
	@ApiResponseEntity(ListForumRepliesDto)
	@SerializeOptions({ type: ListForumRepliesDto, strategy: 'exposeAll' })
	listReplies(@Param('threadId') threadId: string, @Query() query: PageQueryDto) {
		return this.forumService.listForumReplies({ ...query, threadId: threadId });
	}

	@Post('threads/:threadId/replies')
	@ApiOperation({ summary: 'Reply to a thread (ID or slug), optionally quoting a reply' })
	@ApiResponseEntity(ForumReplyDto)
	@SerializeOptions({ type: ForumReplyDto, strategy: 'exposeAll' })
	createReply(
		@Req() req: AuthenticatedRequest,
		@Param('threadId') threadId: string,
		@Body() body: CreateForumReplyDto,
	) {
		return this.forumService.createForumReply({
			...body,
			threadId: threadId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	@Patch('replies/:replyId')
	@ApiOperation({ summary: 'Edit your own reply' })
	@ApiResponseEntity(ForumReplyDto)
	@SerializeOptions({ type: ForumReplyDto, strategy: 'exposeAll' })
	updateReply(
		@Req() req: AuthenticatedRequest,
		@Param('replyId') replyId: string,
		@Body() body: UpdateForumReplyDto,
	) {
		return this.forumService.updateForumReply({
			...body,
			id: replyId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}

	@Delete('replies/:replyId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a reply (author or moderators)' })
	deleteReply(@Req() req: AuthenticatedRequest, @Param('replyId') replyId: string) {
		return this.forumService.deleteForumReply({
			id: replyId,
			...requesterOf(req.user, FORUM_MODERATOR_ROLES),
		});
	}
}
