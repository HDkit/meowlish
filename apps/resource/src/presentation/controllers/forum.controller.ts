import { ForumService } from '../../app/services/forum.service';
import { CreateForumReplyReqDto } from '../dtos/req/forum/create-forum-reply.req.dto';
import { CreateForumThreadReqDto } from '../dtos/req/forum/create-forum-thread.req.dto';
import { DeleteForumReplyReqDto } from '../dtos/req/forum/delete-forum-reply.req.dto';
import { DeleteForumThreadReqDto } from '../dtos/req/forum/delete-forum-thread.req.dto';
import { GetForumCategoryReqDto } from '../dtos/req/forum/get-forum-category.req.dto';
import { GetForumThreadReqDto } from '../dtos/req/forum/get-forum-thread.req.dto';
import { ListForumRepliesReqDto } from '../dtos/req/forum/list-forum-replies.req.dto';
import { ListForumThreadsReqDto } from '../dtos/req/forum/list-forum-threads.req.dto';
import { ModerateForumThreadReqDto } from '../dtos/req/forum/moderate-forum-thread.req.dto';
import { UpdateForumReplyReqDto } from '../dtos/req/forum/update-forum-reply.req.dto';
import { UpdateForumThreadReqDto } from '../dtos/req/forum/update-forum-thread.req.dto';
import { toRequester } from '../dtos/req/requester.req.dto';
import {
	ForumCategoryDto,
	ForumReplyDto,
	ForumThreadDto,
	ListForumCategoriesDto,
	ListForumRepliesDto,
	ListForumThreadsDto,
} from '../dtos/res/forum.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.ForumServiceControllerMethods()
@Controller()
export class ForumController implements resource.ForumServiceController {
	constructor(private readonly forumService: ForumService) {}

	@SerializeOptions({ type: ListForumCategoriesDto, strategy: 'exposeAll' })
	async listForumCategories(): Promise<ListForumCategoriesDto> {
		return this.forumService.listCategories();
	}

	@SerializeOptions({ type: ForumCategoryDto, strategy: 'exposeAll' })
	async getForumCategory(@Payload() data: GetForumCategoryReqDto): Promise<ForumCategoryDto> {
		return this.forumService.getCategory(data.id);
	}

	@SerializeOptions({ type: ListForumThreadsDto, strategy: 'exposeAll' })
	async listForumThreads(@Payload() data: ListForumThreadsReqDto): Promise<ListForumThreadsDto> {
		return this.forumService.listThreads(data);
	}

	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	async createForumThread(@Payload() data: CreateForumThreadReqDto): Promise<ForumThreadDto> {
		return this.forumService.createThread(data, toRequester(data));
	}

	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	async getForumThread(@Payload() data: GetForumThreadReqDto): Promise<ForumThreadDto> {
		return this.forumService.getThread(data.id);
	}

	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	async updateForumThread(@Payload() data: UpdateForumThreadReqDto): Promise<ForumThreadDto> {
		return this.forumService.updateThread(data, toRequester(data));
	}

	@SerializeOptions({ type: ForumThreadDto, strategy: 'exposeAll' })
	async moderateForumThread(@Payload() data: ModerateForumThreadReqDto): Promise<ForumThreadDto> {
		return this.forumService.moderateThread(data, toRequester(data));
	}

	async deleteForumThread(@Payload() data: DeleteForumThreadReqDto): Promise<void> {
		await this.forumService.deleteThread(data.id, toRequester(data));
	}

	@SerializeOptions({ type: ListForumRepliesDto, strategy: 'exposeAll' })
	async listForumReplies(@Payload() data: ListForumRepliesReqDto): Promise<ListForumRepliesDto> {
		return this.forumService.listReplies(data);
	}

	@SerializeOptions({ type: ForumReplyDto, strategy: 'exposeAll' })
	async createForumReply(@Payload() data: CreateForumReplyReqDto): Promise<ForumReplyDto> {
		return this.forumService.createReply(data, toRequester(data));
	}

	@SerializeOptions({ type: ForumReplyDto, strategy: 'exposeAll' })
	async updateForumReply(@Payload() data: UpdateForumReplyReqDto): Promise<ForumReplyDto> {
		return this.forumService.updateReply(data, toRequester(data));
	}

	async deleteForumReply(@Payload() data: DeleteForumReplyReqDto): Promise<void> {
		await this.forumService.deleteReply(data.id, toRequester(data));
	}
}
