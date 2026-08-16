import { TagNode } from '../../domain/read-models/tag/tag-node.read-model';
import { TagTree } from '../../domain/read-models/tag/tag-trees.read-model';
import { type ITagReadRepository } from '../../domain/repositories/tag.read.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/exam';

@Injectable()
export class TagReadPrismaRepositoryImpl implements ITagReadRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async getTagTree(): Promise<TagTree[]> {
		const tags = await this.txHost.tx.tag.findMany({
			orderBy: { lft: 'asc' },
			select: {
				name: true,
				lft: true,
				rgt: true,
			},
		});
		const roots: TagTree[] = [];
		const stack: { node: TagTree; rgt: number }[] = [];
		for (const tag of tags) {
			const node: TagTree = {
				name: tag.name,
				children: [],
			};
			while (stack.length && stack[stack.length - 1].rgt < tag.rgt) {
				stack.pop();
			}
			if (stack.length === 0) {
				roots.push(node);
			} else {
				stack[stack.length - 1].node.children.push(node);
			}
			stack.push({
				node: node,
				rgt: tag.rgt,
			});
		}
		return roots;
	}

	async getTagList(): Promise<TagNode[]> {
		const tags = await this.txHost.tx.tag.findMany({
			orderBy: { lft: 'asc' },
			select: {
				name: true,
				lft: true,
				rgt: true,
			},
		});
		const list: TagNode[] = [];
		const stack: { name: string; rgt: number }[] = [];
		for (const tag of tags) {
			while (stack.length && stack[stack.length - 1].rgt < tag.rgt) {
				stack.pop();
			}
			list.push({
				name: tag.name,
				parent: stack.length > 0 ? stack[stack.length - 1].name : undefined,
			});
			stack.push({
				name: tag.name,
				rgt: tag.rgt,
			});
		}
		return list;
	}
}
