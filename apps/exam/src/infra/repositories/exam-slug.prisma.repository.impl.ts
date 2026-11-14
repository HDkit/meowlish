import { type IExamSlugRepository } from '../../domain/repositories/exam-slug.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/exam';
import { nextFreeSlug, slugify } from '@server/utils';

/** Two writers can pick the same free slug: the unique index rejects one, which then retries. */
const MAX_TRIES = 5;

const isSlugConflict = (e: unknown): boolean =>
	e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class ExamSlugPrismaRepositoryImpl implements IExamSlugRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async assignSlug(examId: string, title: string): Promise<string> {
		const current = await this.txHost.tx.exam.findUnique({
			where: { id: examId },
			select: { slug: true },
		});
		if (current?.slug) return current.slug;
		const base = slugify(title) || 'de-thi';
		for (let attempt = 1; ; attempt++) {
			const taken = await this.txHost.tx.exam.findMany({
				where: { slug: { startsWith: base } },
				select: { slug: true },
			});
			const slug = nextFreeSlug(
				title,
				taken.flatMap(t => (t.slug ? [t.slug] : [])),
				'de-thi',
			);
			try {
				// only fills an empty slug: a concurrent assign for the same exam keeps the first one
				const { count } = await this.txHost.tx.exam.updateMany({
					where: { id: examId, slug: null },
					data: { slug: slug },
				});
				if (count === 0) {
					const now = await this.txHost.tx.exam.findUnique({
						where: { id: examId },
						select: { slug: true },
					});
					return now?.slug ?? slug;
				}
				return slug;
			} catch (e) {
				if (!isSlugConflict(e) || attempt >= MAX_TRIES) throw e;
			}
		}
	}

	async findWithoutSlug(limit: number): Promise<{ id: string; title: string }[]> {
		return this.txHost.tx.exam.findMany({
			where: { slug: null },
			orderBy: { createdAt: 'asc' },
			take: limit,
			select: { id: true, title: true },
		});
	}
}
