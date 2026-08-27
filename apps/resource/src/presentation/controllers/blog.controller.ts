import { BlogService } from '../../app/services/blog.service';
import { CreateBlogReqDto } from '../dtos/req/create-blog.req.dto';
import { DeleteBlogReqDto } from '../dtos/req/delete-blog.req.dto';
import { GetBlogReqDto } from '../dtos/req/get-blog.req.dto';
import { ListBlogsReqDto } from '../dtos/req/list-blogs.req.dto';
import { UpdateBlogReqDto } from '../dtos/req/update-blog.req.dto';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.BlogServiceControllerMethods()
@Controller()
export class BlogController implements resource.BlogServiceController {
	constructor(private readonly blogService: BlogService) {}

	async createBlog(@Payload() data: CreateBlogReqDto): Promise<resource.BlogResponse> {
		return this.blogService.createBlog(data);
	}

	async getBlog(@Payload() data: GetBlogReqDto): Promise<resource.BlogResponse> {
		return this.blogService.getBlog(data.id as string);
	}

	async updateBlog(@Payload() data: UpdateBlogReqDto): Promise<resource.BlogResponse> {
		return this.blogService.updateBlog(data);
	}

	async deleteBlog(@Payload() data: DeleteBlogReqDto): Promise<void> {
		await this.blogService.deleteBlog(data.id as string);
	}

	async listBlogs(@Payload() data: ListBlogsReqDto): Promise<resource.ListBlogsResponse> {
		return this.blogService.listBlogs(data);
	}
}
