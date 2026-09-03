import { BlogService } from '../../app/services/blog.service';
import { CreateBlogReqDto } from '../dtos/req/create-blog.req.dto';
import { DeleteBlogReqDto } from '../dtos/req/delete-blog.req.dto';
import { GetBlogReqDto } from '../dtos/req/get-blog.req.dto';
import { ListBlogsReqDto } from '../dtos/req/list-blogs.req.dto';
import { UpdateBlogReqDto } from '../dtos/req/update-blog.req.dto';
import { BlogDto, ListBlogsDto } from '../dtos/res/blog.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.BlogServiceControllerMethods()
@Controller()
export class BlogController implements resource.BlogServiceController {
	constructor(private readonly blogService: BlogService) {}

	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	async createBlog(@Payload() data: CreateBlogReqDto): Promise<BlogDto> {
		return this.blogService.createBlog(data);
	}

	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	async getBlog(@Payload() data: GetBlogReqDto): Promise<BlogDto> {
		return this.blogService.getBlog(data.id);
	}

	@SerializeOptions({ type: BlogDto, strategy: 'exposeAll' })
	async updateBlog(@Payload() data: UpdateBlogReqDto): Promise<BlogDto> {
		return this.blogService.updateBlog(data);
	}

	async deleteBlog(@Payload() data: DeleteBlogReqDto): Promise<void> {
		await this.blogService.deleteBlog(data.id);
	}

	@SerializeOptions({ type: ListBlogsDto, strategy: 'exposeAll' })
	async listBlogs(@Payload() data: ListBlogsReqDto): Promise<ListBlogsDto> {
		return this.blogService.listBlogs(data);
	}
}
