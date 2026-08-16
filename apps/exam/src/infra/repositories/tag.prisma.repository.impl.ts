import { ITagRepository } from '../../domain/repositories/tag.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, MethodNotAllowedException, NotFoundException } from '@nestjs/common';
import { PrismaClient, Tag as PrismaTag } from '@prisma-client/exam';

@Injectable()
export class TagPrismaRepositoryImpl implements ITagRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	private async getTableLock(): Promise<void> {
		const tableLock =
			(await this.txHost.tx.tagTableLock.findFirst()) ??
			(await this.txHost.tx.tagTableLock.create({}));
		await this.txHost.tx.tagTableLock.update({
			where: { version: tableLock.version },
			data: { version: tableLock.version },
		});
	}

	async addTag(name: string, parentId?: string): Promise<string> {
		return await this.txHost.withTransaction(async (): Promise<string> => {
			await this.getTableLock();
			if (parentId) {
				const parent = await this.txHost.tx.tag.findUnique({ where: { id: parentId } });
				if (!parent) throw new NotFoundException('Parent tag not found');
				await this.txHost.tx.tag.updateMany({
					where: { rgt: { gte: parent.rgt } },
					data: { rgt: { increment: 2 } },
				});
				await this.txHost.tx.tag.updateMany({
					where: { lft: { gt: parent.rgt } },
					data: { lft: { increment: 2 } },
				});
				const newTag = await this.txHost.tx.tag.create({
					data: { name: name, lft: parent.rgt, rgt: parent.rgt + 1 },
				});
				return newTag.id;
			} else {
				const latestTagRoot = await this.txHost.tx.tag.findFirst({
					orderBy: {
						rgt: 'desc',
					},
				});
				const highestRgt = latestTagRoot?.rgt ?? 0;
				const newTag = await this.txHost.tx.tag.create({
					data: { name: name, lft: highestRgt + 1, rgt: highestRgt + 2 },
				});
				return newTag.id;
			}
		});
	}

	async deleteTag(id: string): Promise<void> {
		await this.txHost.withTransaction(async () => {
			await this.getTableLock();
			const foundTag = await this.txHost.tx.tag.findUnique({
				where: { id: id },
			});
			if (!foundTag) throw new NotFoundException('Tag not found');
			const width = foundTag.rgt - foundTag.lft + 1;
			await this.txHost.tx.tag.deleteMany({
				where: {
					lft: { gte: foundTag.lft },
					rgt: { lte: foundTag.rgt },
				},
			});
			await this.txHost.tx.tag.updateMany({
				where: { rgt: { gt: foundTag.rgt } },
				data: { rgt: { decrement: width } },
			});
			await this.txHost.tx.tag.updateMany({
				where: { lft: { gt: foundTag.rgt } },
				data: { lft: { decrement: width } },
			});
		});
	}

	/**
	 * https://stackoverflow.com/a/8775601
	 * Here is a solution that lets you move a node to any position in the tree, either as a sibling or a child with just a single input parameter - the new left position (newlpos) of the node.
	 * Fundamentally there are three steps:
	 * Create new space for the subtree.
	 * Move the subtree into this space.
	 * Remove the old space vacated by the subtree.
	 * In psuedo-sql, it looks like this:
	 *
	 * -- Source - https://stackoverflow.com/a/8775601
	 * -- Retrieved 2026-03-11, License - CC BY-SA 4.0
	 *
	 *  -- create new space for subtree
	 *  UPDATE tags SET lpos = lpos + :width WHERE lpos >= :newlpos
	 *  UPDATE tags SET rpos = rpos + :width WHERE rpos >= :newlpos
	 *
	 *  -- move subtree into new space
	 *  UPDATE tags SET lpos = lpos + :distance, rpos = rpos + :distance
	 *           WHERE lpos >= :tmppos AND rpos < :tmppos + :width
	 *
	 *  -- remove old space vacated by subtree
	 *  UPDATE tags SET lpos = lpos - :width WHERE lpos > :oldrpos
	 *  UPDATE tags SET rpos = rpos - :width WHERE rpos > :oldrpos
	 *
	 *
	 * The :distance variable is the distance between the new and old positions,
	 * the :width is the size of the subtree,
	 * and :tmppos is used to keep track of the subtree being moved during the updates.
	 * These variables are defined as:
   *
   * // calculate position adjustment variables
    int width = node.getRpos() - node.getLpos() + 1;
    int distance = newlpos - node.getLpos();
    int tmppos = node.getLpos();

    // backwards movement must account for new space
    if (distance < 0) {
      distance -= width;
      tmppos += width;
    }
	 */
	async moveTag(id: string, parentId?: string): Promise<void> {
		await this.txHost.withTransaction(async () => {
			await this.getTableLock();
			const node = await this.txHost.tx.tag.findUnique({
				where: { id: id },
			});
			if (!node) throw new NotFoundException('Tag not found');
			let newlpos: number;
			if (parentId) {
				const parent = await this.txHost.tx.tag.findUnique({
					where: { id: parentId },
				});
				if (!parent) throw new NotFoundException('Destination tag not found');
				// cannot move into its own subtree
				if (parent.lft >= node.lft && parent.rgt <= node.rgt) {
					throw new MethodNotAllowedException('Cannot move tag into its own subtree');
				}
				newlpos = parent.rgt;
			} else {
				// move to new root
				const last = await this.txHost.tx.tag.findFirst({
					orderBy: { rgt: 'desc' },
					select: { rgt: true },
				});
				newlpos = (last?.rgt ?? 0) + 1;
			}
			const width = node.rgt - node.lft + 1;
			let distance = newlpos - node.lft;
			let tmppos = node.lft;
			if (distance < 0) {
				distance -= width;
				tmppos += width;
			}
			await this.txHost.tx.tag.updateMany({
				where: { lft: { gte: newlpos } },
				data: { lft: { increment: width } },
			});
			await this.txHost.tx.tag.updateMany({
				where: { rgt: { gte: newlpos } },
				data: { rgt: { increment: width } },
			});
			await this.txHost.tx.tag.updateMany({
				where: {
					lft: { gte: tmppos },
					rgt: { lt: tmppos + width },
				},
				data: {
					lft: { increment: distance },
					rgt: { increment: distance },
				},
			});
			await this.txHost.tx.tag.updateMany({
				where: { lft: { gt: node.rgt } },
				data: { lft: { decrement: width } },
			});
			await this.txHost.tx.tag.updateMany({
				where: { rgt: { gt: node.rgt } },
				data: { rgt: { decrement: width } },
			});
		});
	}

	async updateTag(id: string, name: string): Promise<void> {
		await this.txHost.tx.tag.update({
			where: { id: id },
			data: { name: name },
		});
	}

	private async viewTrees(id?: string): Promise<void> {
		let tags: PrismaTag[] = [];
		if (id) {
			const node = await this.txHost.tx.tag.findUnique({
				where: { id: id },
			});
			if (!node) throw new Error('Tag not found');
			const subtree = await this.txHost.tx.tag.findMany({
				where: {
					lft: { gte: node.lft },
					rgt: { lte: node.rgt },
				},
				orderBy: { lft: 'asc' },
			});
			tags = subtree;
		} else {
			tags = await this.txHost.tx.tag.findMany();
		}
		this.printTrees(tags);
	}

	private printTrees(tags: PrismaTag[]): void {
		console.error('printing trees');
		const sorted = [...tags].sort((a, b) => a.lft - b.lft);
		const stack: PrismaTag[] = [];
		for (const tag of sorted) {
			while (stack.length && stack[stack.length - 1].rgt < tag.lft) {
				stack.pop();
			}
			const depth = stack.length;
			const indent = '  '.repeat(depth);
			console.warn(`${indent}${tag.name} (${tag.lft}, ${tag.rgt})`);
			stack.push(tag);
		}
	}
}
