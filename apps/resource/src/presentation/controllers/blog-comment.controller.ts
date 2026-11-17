import { BlogCommentService } from '../../app/services/blog-comment.service';
import { CreateBlogCommentReqDto } from '../dtos/req/blog-comment/create-blog-comment.req.dto';
import { DeleteBlogCommentReqDto } from '../dtos/req/blog-comment/delete-blog-comment.req.dto';
import { ListBlogCommentsReqDto } from '../dtos/req/blog-comment/list-blog-comments.req.dto';
import { UpdateBlogCommentReqDto } from '../dtos/req/blog-comment/update-blog-comment.req.dto';
import { toRequester } from '../dtos/req/requester.req.dto';
import { BlogCommentDto, ListBlogCommentsDto } from '../dtos/res/blog-comment.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.BlogCommentServiceControllerMethods()
@Controller()
export class BlogCommentController implements resource.BlogCommentServiceController {
	constructor(private readonly blogCommentService: BlogCommentService) {}

	@SerializeOptions({ type: ListBlogCommentsDto, strategy: 'exposeAll' })
	async listBlogComments(@Payload() data: ListBlogCommentsReqDto): Promise<ListBlogCommentsDto> {
		return this.blogCommentService.listComments(data);
	}

	@SerializeOptions({ type: BlogCommentDto, strategy: 'exposeAll' })
	async createBlogComment(@Payload() data: CreateBlogCommentReqDto): Promise<BlogCommentDto> {
		return this.blogCommentService.createComment(data, toRequester(data));
	}

	@SerializeOptions({ type: BlogCommentDto, strategy: 'exposeAll' })
	async updateBlogComment(@Payload() data: UpdateBlogCommentReqDto): Promise<BlogCommentDto> {
		return this.blogCommentService.updateComment(data, toRequester(data));
	}

	async deleteBlogComment(@Payload() data: DeleteBlogCommentReqDto): Promise<void> {
		await this.blogCommentService.deleteComment(data.id, toRequester(data));
	}
}
