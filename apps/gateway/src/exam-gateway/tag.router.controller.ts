import { IsPublic } from '../auth/decorators/public.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { EXAM_CLIENT } from './constants/exam';
import { AddTagDto } from './dtos/req/tag/add-tag.req.dto';
import { MoveTagDto } from './dtos/req/tag/move-tag.req.dto';
import { UpdateTagDto } from './dtos/req/tag/update-tag.dto';
import { AddedTagDto } from './dtos/res/tag/added-tag.res.dto';
import { TagListDto } from './dtos/res/tag/tag-list.res.dto';
import { TagTreesDto } from './dtos/res/tag/tag-trees.res.dto';
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
	SerializeOptions,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

@HasRoles(Role.Mod, Role.Admin)
@ApiBearerAuth()
@ApiTags('Tags')
@Controller('tags')
export class TagGatewayController implements OnModuleInit {
	private tagService!: exam.TagServiceClient;

	constructor(@Inject(EXAM_CLIENT) private readonly examClient: ClientGrpc) {}

	onModuleInit() {
		this.tagService = this.examClient.getService<exam.TagServiceClient>(exam.TAG_SERVICE_NAME);
	}

	@Post()
	@ApiOperation({ summary: 'Create a tag' })
	@ApiResponseEntity(AddedTagDto)
	@SerializeOptions({ type: AddedTagDto })
	addTag(@Body() body: AddTagDto) {
		return this.tagService.addTag(body);
	}

	@Delete(':id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a tag' })
	deleteTag(@Param('id') id: string) {
		return this.tagService.deleteTag({ id: id });
	}

	@Post(':id/move')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Move a tag under another parent' })
	moveTag(@Body() body: MoveTagDto, @Param('id') id: string) {
		return this.tagService.moveTag({ ...body, id: id });
	}

	@Patch(':id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Rename a tag' })
	updateTag(@Body() body: UpdateTagDto, @Param('id') id: string) {
		return this.tagService.updateTag({ ...body, id: id });
	}

	@Get('tree')
	@IsPublic()
	@ApiOperation({ summary: 'Fetch all tags in a tree format' })
	@ApiResponseEntity(TagTreesDto)
	@SerializeOptions({ type: TagTreesDto, strategy: 'exposeAll' })
	getTagTree() {
		return this.tagService.getTagTree({});
	}

	@Get('list')
	@IsPublic()
	@ApiOperation({ summary: 'Fetch all tags as a list' })
	@ApiResponseEntity(TagListDto)
	@SerializeOptions({ type: TagListDto, strategy: 'exposeAll' })
	getTagList() {
		return this.tagService.getTagList({});
	}
}
