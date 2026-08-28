import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { RESOURCE_CLIENT } from './constants/resource';
import { CreateBlogDto } from './dtos/req/create-blog.req.dto';
import { CreateFlashCardListDto } from './dtos/req/create-flash-card-list.req.dto';
import { CreateFlashCardDto } from './dtos/req/create-flash-card.req.dto';
import { CreateReportDto } from './dtos/req/create-report.req.dto';
import { UpdateBlogDto } from './dtos/req/update-blog.req.dto';
import { UpdateFlashCardListDto } from './dtos/req/update-flash-card-list.req.dto';
import { UpdateFlashCardDto } from './dtos/req/update-flash-card.req.dto';
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
	PipeTransform,
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
		} as resource.CreateBlogRequest);
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
		} as resource.UpdateBlogRequest);
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
	listBlogs(
		@Query(
			'tags',
			new (class implements PipeTransform {
				transform(value: string) {
					return (
						Array.isArray(value) ? value
						: value ? [value]
						: []
					);
				}
			})(),
		)
		tags: string[],
		@Query('authorId') authorId?: string,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.blogService.listBlogs({
			authorId: authorId,
			tags: tags ?? [],
			page: page,
			limit: limit,
		});
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
			authorId: req.user.sub,
		} as resource.CreateFlashCardRequest);
	}

	@Get('flash-cards/:id')
	@ApiOperation({ summary: 'Get a flash card by ID' })
	@ApiResponseEntity(FlashCardDto)
	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	getFlashCard(@Param('id') id: string) {
		return this.flashCardService.getFlashCard({ id: id });
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
		} as resource.UpdateFlashCardRequest);
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
	listFlashCards(
		@Query('tags') tags: string[],
		@Query('authorId') authorId?: string,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.flashCardService.listFlashCards({
			authorId: authorId,
			tags: tags ?? [],
			page: page,
			limit: limit,
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
		} as resource.CreateFlashCardListRequest);
	}

	@Get('flash-card-lists/:id')
	@ApiOperation({ summary: 'Get a flash card list detail' })
	@ApiResponseEntity(FlashCardListDetailDto)
	@SerializeOptions({ type: FlashCardListDetailDto, strategy: 'exposeAll' })
	getFlashCardList(@Param('id') id: string) {
		return this.flashCardListService.getFlashCardList({ id: id });
	}

	@Patch('flash-card-lists/:id')
	@ApiOperation({ summary: 'Update a flash card list' })
	@ApiResponseEntity(FlashCardListDto)
	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	updateFlashCardList(@Param('id') id: string, @Body() body: UpdateFlashCardListDto) {
		return this.flashCardListService.updateFlashCardList({
			...body,
			tags: body.tags ?? [],
			id: id,
		} as resource.UpdateFlashCardListRequest);
	}

	@Delete('flash-card-lists/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a flash card list' })
	deleteFlashCardList(@Param('id') id: string) {
		return this.flashCardListService.deleteFlashCardList({ id: id });
	}

	@Get('flash-card-lists')
	@ApiOperation({ summary: 'List flash card lists' })
	@ApiResponseEntity(ListFlashCardListsDto)
	@SerializeOptions({ type: ListFlashCardListsDto, strategy: 'exposeAll' })
	listFlashCardLists(
		@Query('tags') tags: string[],
		@Query('authorId') authorId?: string,
		@Query('isPublic') isPublic?: boolean,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.flashCardListService.listFlashCardLists({
			authorId: authorId,
			isPublic: isPublic,
			tags: tags ?? [],
			page: page,
			limit: limit,
		});
	}

	@Post('flash-card-lists/:id/cards')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add a card to a list' })
	addCardToList(
		@Param('id') id: string,
		@Body() body: Omit<resource.AddCardToListRequest, 'list_id'>,
	) {
		return this.flashCardListService.addCardToList({ ...body, listId: id });
	}

	@Delete('flash-card-lists/:listId/cards/:cardId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove a card from a list' })
	removeCardFromList(@Param('listId') listId: string, @Param('cardId') cardId: string) {
		return this.flashCardListService.removeCardFromList({ listId: listId, flashCardId: cardId });
	}

	@Get('flash-card-lists/:id/cards')
	@ApiOperation({ summary: 'List cards in a list' })
	@ApiResponseEntity(ListFlashCardsDto)
	@SerializeOptions({ type: ListFlashCardsDto, strategy: 'exposeAll' })
	listCardsInList(
		@Param('id') id: string,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.flashCardListService.listCardsInList({ listId: id, page: page, limit: limit });
	}

	// ── Reports ──────────────────────────────────────────────────────────────

	@Post('reports')
	@ApiOperation({ summary: 'Create a report' })
	createReport(@Req() req: AuthenticatedRequest, @Body() body: CreateReportDto) {
		return this.reportService.createReport({
			...body,
			fileIds: body.fileIds ?? [],
			reportedBy: req.user.sub,
		} as resource.CreateReportRequest);
	}

	@Get('reports/:id')
	@ApiOperation({ summary: 'Get a report by ID' })
	@ApiResponseEntity(ReportDto)
	@SerializeOptions({ type: ReportDto, strategy: 'exposeAll' })
	getReport(@Param('id') id: string) {
		return this.reportService.getReport({ id: id });
	}

	@Patch('reports/:id')
	@ApiOperation({ summary: 'Update a report' })
	updateReport(@Param('id') id: string, @Body() body: Omit<resource.UpdateReportRequest, 'id'>) {
		return this.reportService.updateReport({ ...body, id: id });
	}

	@Delete('reports/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a report' })
	deleteReport(@Param('id') id: string) {
		return this.reportService.deleteReport({ id: id });
	}

	@Get('reports')
	@ApiOperation({ summary: 'List reports' })
	@ApiResponseEntity(ListReportsDto)
	@SerializeOptions({ type: ListReportsDto, strategy: 'exposeAll' })
	listReports(
		@Query('reportedBy') reportedBy?: string,
		@Query('type') type?: string,
		@Query('status') status?: string,
		@Query('targetType') targetType?: string,
		@Query('targetId') targetId?: string,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		return this.reportService.listReports({
			reportedBy: reportedBy,
			type: type,
			status: status,
			targetType: targetType,
			targetId: targetId,
			page: page,
			limit: limit,
		});
	}

	@Post('reports/:id/files')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add a file to a report' })
	addFileToReport(
		@Param('id') id: string,
		@Body() body: Omit<resource.AddFileToReportRequest, 'report_id'>,
	) {
		return this.reportService.addFileToReport({ ...body, reportId: id });
	}

	@Delete('reports/:reportId/files/:fileId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove a file from a report' })
	removeFileFromReport(@Param('reportId') reportId: string, @Param('fileId') fileId: string) {
		return this.reportService.removeFileFromReport({ reportId: reportId, fileId: fileId });
	}
}
