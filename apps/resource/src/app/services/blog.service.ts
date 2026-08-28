import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Blog, PrismaClient } from '@prisma-client/resource';
import { resource } from '@server/generated';
import { AppLoggerService } from '@server/logger';

@Injectable()
export class BlogService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {}

	private get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

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
		const created = await this.txHost.tx.blog.create({
			data: {
				title: data.title as string,
				content: data.content as string,
				authorId: data.authorId as string,
				tags: data.tags || [],
			},
		});

		try {
			await this.amqpConnection.publish(
				'eventbus',
				'resource.resource.created',
				{ resourceType: 'blog', resourceId: created.id, ownerId: data.authorId },
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(`Failed to publish resource.resource.created event: ${e as string}`);
		}

		return this.mapToResponse(created);
	}

	async getBlog(id: string): Promise<resource.BlogResponse> {
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		return this.mapToResponse(entity);
	}

	async updateBlog(data: resource.UpdateBlogRequest): Promise<resource.BlogResponse> {
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: data.id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		const updated = await this.txHost.tx.blog.update({
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
		const entity = await this.txHost.tx.blog.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Blog not found');
		}
		await this.txHost.tx.blog.delete({ where: { id: id } });

		try {
			await this.amqpConnection.publish(
				'eventbus',
				'resource.resource.deleted',
				{ resourceType: 'blog', resourceId: id },
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(`Failed to publish resource.resource.deleted event: ${e as string}`);
		}
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
			this.txHost.tx.blog.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.blog.count({ where: where }),
		]);

		return {
			blogs: blogs.map(b => this.mapToResponse(b)),
			totalCount: totalCount,
		};
	}
}
