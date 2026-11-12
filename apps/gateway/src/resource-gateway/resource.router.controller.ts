import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { hasAnyRole, requesterOf } from '../auth/functions/requester';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { RESOURCE_CLIENT } from './constants/resource';
import { AddCardToListDto } from './dtos/req/add-card-to-list.req.dto';
import { AddFileToReportDto } from './dtos/req/add-file-to-report.req.dto';
import { CreateBlogDto } from './dtos/req/create-blog.req.dto';
import { CreateFlashCardListDto } from './dtos/req/create-flash-card-list.req.dto';
import { CreateFlashCardDto } from './dtos/req/create-flash-card.req.dto';
import { CreateReportDto } from './dtos/req/create-report.req.dto';
import { ListBlogsQueryDto } from './dtos/req/list-blogs.query.dto';
import { ListFlashCardListsQueryDto } from './dtos/req/list-flash-card-lists.query.dto';
import { ListFlashCardsQueryDto } from './dtos/req/list-flash-cards.query.dto';
import { ListReportsQueryDto } from './dtos/req/list-reports.query.dto';
import { PageQueryDto } from './dtos/req/page.query.dto';
import { UpdateBlogDto } from './dtos/req/update-blog.req.dto';
import { UpdateFlashCardListDto } from './dtos/req/update-flash-card-list.req.dto';
import { UpdateFlashCardDto } from './dtos/req/update-flash-card.req.dto';
import { UpdateReportDto } from './dtos/req/update-report.req.dto';
import { BlogDto, ListBlogsDto } from './dtos/res/blog.dto';
import {
	FlashCardListDetailDto,
	FlashCardListDto,
	ListFlashCardListsDto,
} from './dtos/res/flash-card-list.dto';
import { FlashCardDto, ListFlashCardsDto } from './dtos/res/flash-card.dto';
import { ListReportsDto, ReportDto } from './dtos/res/report.dto';
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

/** Admins may read and manage every flash card list, including private ones. */
const FLASH_CARD_ADMIN_ROLES = [Role.Admin] as const;
/** Staff who triage reports: they see every report, everyone else only their own. */
const REPORT_STAFF_ROLES = [Role.Mod, Role.Admin] as const;

@ApiBearerAuth()
@ApiTags('Resources')
@Controller()
export class ResourceGatewayController implements OnModuleInit {
	private blogService!: resource.BlogServiceClient;
	private flashCardService!: resource.FlashCardServiceClient;
	private flashCardListService!: resource.FlashCardListServiceClient;
	private reportService!: resource.ReportServiceClient;

	constructor(@Inject(RESOURCE_CLIENT) private readonly resourceClient: ClientGrpc) {}

	onModuleInit() {
		this.blogService = this.resourceClient.getService<resource.BlogServiceClient>(
			resource.BLOG_SERVICE_NAME,
		);
		this.flashCardService = this.resourceClient.getService<resource.FlashCardServiceClient>(
			resource.FLASH_CARD_SERVICE_NAME,
		);
		this.flashCardListService = this.resourceClient.getService<resource.FlashCardListServiceClient>(
			resource.FLASH_CARD_LIST_SERVICE_NAME,
		);
		this.reportService = this.resourceClient.getService<resource.ReportServiceClient>(
			resource.REPORT_SERVICE_NAME,
		);
	}

	// ── Blogs ────────────────────────────────────────────────────────────────

	@Post('blogs')
	@ApiOperation({ summary: 'Create a blog post' })
	@ApiResponseEntity(BlogDto)
	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	createBlog(@Req() req: AuthenticatedRequest, @Body() body: CreateBlogDto) {
		return this.blogService.createBlog({
			...body,
			tags: body.tags ?? [],
			authorId: req.user.sub,
		});
	}

	@Get('blogs/:id')
	@ApiOperation({ summary: 'Get a blog post by ID' })
	@ApiResponseEntity(BlogDto)
	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	getBlog(@Param('id') id: string) {
		return this.blogService.getBlog({ id: id });
	}

	@Patch('blogs/:id')
	@ApiOperation({ summary: 'Update a blog post' })
	@ApiResponseEntity(BlogDto)
	@ResourceAccess({
		resourceType: 'blog',
		resourceIdParam: 'id',
		rules: [
			{ roles: [Role.Admin] },
			{ roles: [Role.Mod, Role.User, Role.Student, Role.Teacher], requireOwnership: true },
		],
	})
	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	updateBlog(@Param('id') id: string, @Body() body: UpdateBlogDto) {
		return this.blogService.updateBlog({
			...body,
			tags: body.tags ?? [],
			id: id,
		});
	}

	@Delete('blogs/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a blog post' })
	@ResourceAccess({
		resourceType: 'blog',
		resourceIdParam: 'id',
		rules: [
			{ roles: [Role.Admin] },
			{ roles: [Role.Mod, Role.User, Role.Student, Role.Teacher], requireOwnership: true },
		],
	})
	deleteBlog(@Param('id') id: string) {
		return this.blogService.deleteBlog({ id: id });
	}

	@Get('blogs')
	@ApiOperation({ summary: 'List blog posts' })
	@ApiResponseEntity(ListBlogsDto)
	@SerializeOptions({ type: ListBlogsDto, strategy: 'exposeAll' })
	listBlogs(@Query() query: ListBlogsQueryDto) {
		return this.blogService.listBlogs(query);
	}

	// ── Flash Cards ──────────────────────────────────────────────────────────

	@Post('flash-cards')
	@ApiOperation({ summary: 'Create a flash card' })
	@ApiResponseEntity(FlashCardDto)
	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	createFlashCard(@Req() req: AuthenticatedRequest, @Body() body: CreateFlashCardDto) {
		return this.flashCardService.createFlashCard({
			...body,
			examples: body.examples ?? [],
			tags: body.tags ?? [],
			listId: body.listId,
			authorId: req.user.sub,
		});
	}

	@Get('flash-cards/:id')
	@ApiOperation({ summary: 'Get a flash card by ID' })
	@ApiResponseEntity(FlashCardDto)
	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	getFlashCard(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardService.getFlashCard({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Patch('flash-cards/:id')
	@ApiOperation({ summary: 'Update a flash card' })
	@ApiResponseEntity(FlashCardDto)
	@ResourceAccess({
		resourceType: 'flashcard',
		resourceIdParam: 'id',
		rules: [
			{ roles: [Role.Admin] },
			{ roles: [Role.Mod, Role.User, Role.Student, Role.Teacher], requireOwnership: true },
		],
	})
	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	updateFlashCard(@Param('id') id: string, @Body() body: UpdateFlashCardDto) {
		return this.flashCardService.updateFlashCard({
			...body,
			examples: body.examples ?? [],
			tags: body.tags ?? [],
			id: id,
		});
	}

	@Delete('flash-cards/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a flash card' })
	@ResourceAccess({
		resourceType: 'flashcard',
		resourceIdParam: 'id',
		rules: [
			{ roles: [Role.Admin] },
			{ roles: [Role.Mod, Role.User, Role.Student, Role.Teacher], requireOwnership: true },
		],
	})
	deleteFlashCard(@Param('id') id: string) {
		return this.flashCardService.deleteFlashCard({ id: id });
	}

	@Get('flash-cards')
	@ApiOperation({ summary: 'List flash cards' })
	@ApiResponseEntity(ListFlashCardsDto)
	@SerializeOptions({ type: ListFlashCardsDto, strategy: 'exposeAll' })
	listFlashCards(@Req() req: AuthenticatedRequest, @Query() query: ListFlashCardsQueryDto) {
		return this.flashCardService.listFlashCards({
			...query,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	// ── Flash Card Lists ─────────────────────────────────────────────────────

	@Post('flash-card-lists')
	@ApiOperation({ summary: 'Create a flash card list' })
	@ApiResponseEntity(FlashCardListDto)
	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	createFlashCardList(@Req() req: AuthenticatedRequest, @Body() body: CreateFlashCardListDto) {
		return this.flashCardListService.createFlashCardList({
			...body,
			tags: body.tags ?? [],
			authorId: req.user.sub,
		});
	}

	@Get('flash-card-lists/:id')
	@ApiOperation({ summary: 'Get a flash card list detail' })
	@ApiResponseEntity(FlashCardListDetailDto)
	@SerializeOptions({ type: FlashCardListDetailDto, strategy: 'exposeAll' })
	getFlashCardList(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardListService.getFlashCardList({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Patch('flash-card-lists/:id')
	@ApiOperation({ summary: 'Update a flash card list' })
	@ApiResponseEntity(FlashCardListDto)
	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	updateFlashCardList(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: UpdateFlashCardListDto,
	) {
		return this.flashCardListService.updateFlashCardList({
			...body,
			tags: body.tags ?? [],
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Delete('flash-card-lists/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a flash card list' })
	deleteFlashCardList(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardListService.deleteFlashCardList({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Get('flash-card-lists')
	@ApiOperation({ summary: 'List flash card lists' })
	@ApiResponseEntity(ListFlashCardListsDto)
	@SerializeOptions({ type: ListFlashCardListsDto, strategy: 'exposeAll' })
	listFlashCardLists(@Req() req: AuthenticatedRequest, @Query() query: ListFlashCardListsQueryDto) {
		return this.flashCardListService.listFlashCardLists({
			...query,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Post('flash-card-lists/:id/cards')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add a card to a list' })
	addCardToList(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: AddCardToListDto,
	) {
		return this.flashCardListService.addCardToList({
			...body,
			listId: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Get('flash-card-lists/:id/cards')
	@ApiOperation({ summary: 'List cards in a list' })
	@ApiResponseEntity(ListFlashCardsDto)
	@SerializeOptions({ type: ListFlashCardsDto, strategy: 'exposeAll' })
	listCardsInList(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Query() query: PageQueryDto,
	) {
		return this.flashCardListService.listCardsInList({
			...query,
			listId: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	// ── Reports ──────────────────────────────────────────────────────────────

	@Post('reports')
	@ApiOperation({ summary: 'Create a report' })
	@ApiResponseEntity(ReportDto)
	@SerializeOptions({ type: ReportDto, strategy: 'exposeAll' })
	createReport(@Req() req: AuthenticatedRequest, @Body() body: CreateReportDto) {
		return this.reportService.createReport({
			...body,
			fileIds: body.fileIds ?? [],
			reportedBy: req.user.sub,
		});
	}

	@Get('reports/:id')
	@ApiOperation({ summary: 'Get a report by ID (reporter or moderators/admins)' })
	@ApiResponseEntity(ReportDto)
	@SerializeOptions({ type: ReportDto, strategy: 'exposeAll' })
	getReport(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.reportService.getReport({
			id: id,
			...requesterOf(req.user, REPORT_STAFF_ROLES),
		});
	}

	@Patch('reports/:id')
	@HasRoles(...REPORT_STAFF_ROLES)
	@ApiOperation({ summary: 'Update a report (moderators/admins)' })
	@ApiResponseEntity(ReportDto)
	@SerializeOptions({ type: ReportDto, strategy: 'exposeAll' })
	updateReport(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: UpdateReportDto,
	) {
		return this.reportService.updateReport({ ...body, id: id, resolvedBy: req.user.sub });
	}

	@Delete('reports/:id')
	@HasRoles(...REPORT_STAFF_ROLES)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a report (moderators/admins)' })
	deleteReport(@Param('id') id: string) {
		return this.reportService.deleteReport({ id: id });
	}

	@Get('reports')
	@ApiOperation({ summary: 'List reports (your own; moderators/admins see all)' })
	@ApiResponseEntity(ListReportsDto)
	@SerializeOptions({ type: ListReportsDto, strategy: 'exposeAll' })
	listReports(@Req() req: AuthenticatedRequest, @Query() query: ListReportsQueryDto) {
		return this.reportService.listReports({
			...query,
			...requesterOf(req.user, REPORT_STAFF_ROLES),
		});
	}

	@Post('reports/:id/files')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add a file to a report' })
	addFileToReport(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: AddFileToReportDto,
	) {
		return this.reportService.addFileToReport({
			...body,
			reportId: id,
			...requesterOf(req.user, REPORT_STAFF_ROLES),
			// Only admins may attach a file someone else uploaded.
			mayAttachAnyFile: hasAnyRole(req.user, [Role.Admin]),
		});
	}

	@Delete('reports/:reportId/files/:fileId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove a file from a report' })
	removeFileFromReport(
		@Req() req: AuthenticatedRequest,
		@Param('reportId') reportId: string,
		@Param('fileId') fileId: string,
	) {
		return this.reportService.removeFileFromReport({
			reportId: reportId,
			fileId: fileId,
			...requesterOf(req.user, REPORT_STAFF_ROLES),
		});
	}
}
