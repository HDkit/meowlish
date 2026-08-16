import { BlogService } from '../../app/services/blog.service';
import { Controller } from '@nestjs/common';
import { resource } from '@server/generated';

@resource.BlogServiceControllerMethods()
@Controller()
export class BlogController implements resource.BlogServiceController {
	constructor(private readonly blogService: BlogService) {}

	async createBlog(data: resource.CreateBlogRequest): Promise<resource.BlogResponse> {
		return this.blogService.createBlog(data);
	}

	async getBlog(data: resource.GetBlogRequest): Promise<resource.BlogResponse> {
		return this.blogService.getBlog(data.id as string);
	}

	async updateBlog(data: resource.UpdateBlogRequest): Promise<resource.BlogResponse> {
		return this.blogService.updateBlog(data);
	}

	async deleteBlog(data: resource.DeleteBlogRequest): Promise<void> {
		await this.blogService.deleteBlog(data.id as string);
	}

	async listBlogs(data: resource.ListBlogsRequest): Promise<resource.ListBlogsResponse> {
		return this.blogService.listBlogs(data);
	}
}
