import { Identity } from '../../../domain/entities/identity.entity';
import { IdentityPrismaRepositoryImpl } from '../../../infra/repositories/identity.prisma.repository.impl';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma-client/auth';

jest.mock('@prisma-client/auth', () => ({
	Prisma: {
		PrismaClientKnownRequestError: class extends Error {
			code: string;
			constructor(message: string, options: { code: string }) {
				super(message);
				this.code = options.code;
			}
		},
	},
}));

const prismaError = (code: string) =>
	new Prisma.PrismaClientKnownRequestError(code, { code: code, clientVersion: 'test' });

const setup = () => {
	const tx = {
		identity: { create: jest.fn(), update: jest.fn() },
		identityRole: { create: jest.fn() },
	};
	const txHost = {
		tx: tx,
		withTransaction: (fn: () => Promise<void>) => fn(),
	};
	const repo = new IdentityPrismaRepositoryImpl(txHost as never);
	return { repo: repo, tx: tx };
};

/** An identity as loaded from the database (version >= 1, so save() updates). */
const loaded = () => new Identity({ id: 'i1', username: 'u', version: 1 });

describe('IdentityPrismaRepositoryImpl.save', () => {
	it('a lost optimistic-version race (P2025) is a 409', async () => {
		const { repo, tx } = setup();
		tx.identity.update.mockRejectedValue(prismaError('P2025'));
		await expect(repo.save(loaded())).rejects.toBeInstanceOf(ConflictException);
	});

	it('assigning an unknown role (FK P2003) is a 404', async () => {
		const { repo, tx } = setup();
		tx.identityRole.create.mockRejectedValue(prismaError('P2003'));
		const identity = loaded();
		identity.addRole('no-such-role');
		await expect(repo.save(identity)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('other errors pass through unchanged', async () => {
		const { repo, tx } = setup();
		const error = new Error('db down');
		tx.identity.update.mockRejectedValue(error);
		await expect(repo.save(loaded())).rejects.toBe(error);
	});
});
