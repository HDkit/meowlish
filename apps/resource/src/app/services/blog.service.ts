import {
	type BlogListReadModel,
	type BlogReadModel,
	type BlogTagCountReadModel,
} from '../../domain/read-models/blog.read-model';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	type CreateBlogInput,
	type ListBlogsInput,
	type UpdateBlogInput,
} from '../types/blog.input';
import { toSkipTake } from '../types/pagination';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Blog, Prisma, PrismaClient } from '@prisma-client/resource';

@Injectable()
export class BlogService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
	) {}

	private toReadModel(entity: Blog): BlogReadModel {
		return {
			id: entity.id,
			title: entity.title,
			content: entity.content,
			authorId: entity.authorId,
			tags: entity.tags,
			createdAt: entity.createdAt.toISOString(),
			updatedAt: entity.updatedAt.toISOString(),
		};
	}

	@Transactional()
	async createBlog(data: CreateBlogInput): Promise<BlogReadModel> {
		const created = await this.txHost.tx.blog.create({
			data: {
				title: data.title,
				content: data.content,
				authorId: data.authorId,
				tags: data.tags,
			},
		});
		await this.events.resourceCreated('blog', created.id, created.authorId);
		return this.toReadModel(created);
	}

	async getBlog(id: string): Promise<BlogReadModel> {
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: id } });
		if (!entity) throw new NotFoundException('Blog not found');
		return this.toReadModel(entity);
	}

	async updateBlog(data: UpdateBlogInput): Promise<BlogReadModel> {
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: data.id } });
		if (!entity) throw new NotFoundException('Blog not found');

		const updated = await this.txHost.tx.blog.update({
			where: { id: data.id },
			data: {
				title: data.title ?? entity.title,
				content: data.content ?? entity.content,
				tags: data.replaceTags || data.tags.length > 0 ? data.tags : entity.tags,
			},
		});
		return this.toReadModel(updated);
	}

	@Transactional()
	async deleteBlog(id: string): Promise<void> {
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: id } });
		if (!entity) throw new NotFoundException('Blog not found');

		await this.txHost.tx.blog.delete({ where: { id: id } });
		await this.events.resourcesDeleted('blog', [id]);
	}

	async listBlogs(data: ListBlogsInput): Promise<BlogListReadModel> {
		const where: Prisma.BlogWhereInput = {};
		if (data.authorId) where.authorId = data.authorId;
		if (data.tags.length > 0) where.tags = { hasSome: data.tags };

		const [blogs, totalCount] = await Promise.all([
			this.txHost.tx.blog.findMany({
				where: where,
				...toSkipTake(data),
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.blog.count({ where: where }),
		]);

		return { blogs: blogs.map(b => this.toReadModel(b)), totalCount: totalCount };
	}

	/** Every tag of every post, most used first (then by name), so filters can offer all of them. */
	async listBlogTags(): Promise<BlogTagCountReadModel[]> {
		const rows = await this.txHost.tx.$queryRaw<{ name: string; count: number }[]>`
			SELECT tag AS name, COUNT(*)::int AS count
			FROM blogs, unnest(tags) AS tag
			GROUP BY tag
			ORDER BY count DESC, tag ASC`;
		return rows.map(r => ({ name: r.name, count: r.count }));
	}
}
