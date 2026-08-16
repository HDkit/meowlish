import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Blog, PrismaClient } from '@prisma-client/resource';
import { DATABASE_SERVICE } from '@server/database';
import { resource } from '@server/generated';

@Injectable()
export class BlogService {
	constructor(@Inject(DATABASE_SERVICE) private readonly prisma: PrismaClient) {}

	private mapToResponse(entity: Blog): resource.BlogResponse {
		return {
			id: entity.id,
			title: entity.title,
			content: entity.content,
			authorId: entity.authorId,
			tags: entity.tags || [],
			createdAt: entity.createdAt.toISOString(),
			updatedAt: entity.updatedAt.toISOString(),
		};
	}

	async createBlog(data: resource.CreateBlogRequest): Promise<resource.BlogResponse> {
		const created = await this.prisma.blog.create({
			data: {
				title: data.title as string,
				content: data.content as string,
				authorId: data.authorId as string,
				tags: data.tags || [],
			},
		});
		return this.mapToResponse(created);
	}

	async getBlog(id: string): Promise<resource.BlogResponse> {
		const entity = await this.prisma.blog.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		return this.mapToResponse(entity);
	}

	async updateBlog(data: resource.UpdateBlogRequest): Promise<resource.BlogResponse> {
		const entity = await this.prisma.blog.findUnique({ where: { id: data.id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		const updated = await this.prisma.blog.update({
			where: { id: data.id },
			data: {
				title: data.title ?? entity.title,
				content: data.content ?? entity.content,
				tags: data.tags && data.tags.length > 0 ? data.tags : entity.tags,
			},
		});
		return this.mapToResponse(updated);
	}

	async deleteBlog(id: string): Promise<void> {
		const entity = await this.prisma.blog.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		await this.prisma.blog.delete({ where: { id: id } });
	}

	async listBlogs(data: resource.ListBlogsRequest): Promise<resource.ListBlogsResponse> {
		const page = data.page || 1;
		const limit = data.limit || 10;
		const skip = (page - 1) * limit;

		const where: { authorId?: string; tags?: { hasSome: string[] } } = {};
		if (data.authorId) {
			where.authorId = data.authorId;
		}
		if (data.tags && data.tags.length > 0) {
			where.tags = { hasSome: data.tags };
		}

		const [blogs, totalCount] = await Promise.all([
			this.prisma.blog.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.blog.count({ where: where }),
		]);

		return {
			blogs: blogs.map(b => this.mapToResponse(b)),
			totalCount: totalCount,
		};
	}
}
