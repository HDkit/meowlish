export interface PageInput {
	page?: number;
	limit?: number;
}

/** Normalises 1-based page/limit into Prisma skip/take. */
export const toSkipTake = ({ page, limit }: PageInput): { skip: number; take: number } => {
	const take = limit && limit > 0 ? limit : 10;
	const current = page && page > 0 ? page : 1;
	return { skip: (current - 1) * take, take: take };
};
