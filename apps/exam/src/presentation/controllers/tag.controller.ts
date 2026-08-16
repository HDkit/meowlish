import { TagService } from '../../app/services/tag.service';
import { AddTagDto } from '../dtos/req/tag/add-tag.req.dto';
import { DeleteTagDto } from '../dtos/req/tag/delete-tag.req.dto';
import { MoveTagDto } from '../dtos/req/tag/move-tag.req.dto';
import { UpdateTagDto } from '../dtos/req/tag/update-tag.dto';
import { AddedTagDto } from '../dtos/res/tag/added-tag.res.dto';
import { TagListDto } from '../dtos/res/tag/tag-list.res.dto';
import { TagTreesDto } from '../dtos/res/tag/tag-trees.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { exam } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@exam.TagServiceControllerMethods()
@Controller()
export class TagController implements exam.TagServiceController {
	constructor(private readonly tagService: TagService) {}

	@SerializeOptions({ type: AddedTagDto })
	async addTag(@Payload() request: AddTagDto): Promise<AddedTagDto> {
		const tagId = await this.tagService.addTag(request.name, request.parentId);
		return { id: tagId };
	}

	async deleteTag(@Payload() request: DeleteTagDto): Promise<void> {
		return this.tagService.deleteTag(request.id);
	}

	async moveTag(@Payload() request: MoveTagDto): Promise<void> {
		return this.tagService.moveTag(request.id, request.parentId);
	}

	async updateTag(@Payload() request: UpdateTagDto): Promise<void> {
		return this.tagService.updateTag(request.id, request.name);
	}

	@SerializeOptions({ type: TagListDto, strategy: 'exposeAll' })
	async getTagList(): Promise<TagListDto> {
		return { list: await this.tagService.getTagList() };
	}

	@SerializeOptions({ type: TagTreesDto, strategy: 'exposeAll' })
	async getTagTree(): Promise<TagTreesDto> {
		return { trees: await this.tagService.getTagTree() };
	}
}
