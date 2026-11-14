import { IdentityReadPrismaRepositoryImpl } from '../../../infra/repositories/identity.read.prisma.repository.impl';

jest.mock('@prisma-client/auth', () => ({}));

const setup = () => {
	const findMany = jest.fn().mockResolvedValue([]);
	const repo = new IdentityReadPrismaRepositoryImpl({
		tx: { identity: { findMany: findMany } },
	} as never);
	const where = () => (findMany.mock.calls[0] as [{ where: object }])[0].where;
	return { repo: repo, where: where };
};

describe('IdentityReadPrismaRepositoryImpl searches skip soft-deleted identities', () => {
	it('findIdentityIds', async () => {
		const { repo, where } = setup();
		await repo.findIdentityIds({ usernameOrCredentialIdentifier: 'a', usernameOnly: true });
		expect(where()).toMatchObject({ deletedAt: null });
	});

	it('findIdentities', async () => {
		const { repo, where } = setup();
		await repo.findIdentities({ usernameOrCredentialIdentifierOrId: 'a', hasRoles: ['ADMIN'] });
		expect(where()).toMatchObject({ deletedAt: null });
	});

	it('findIdentitiesByPhone', async () => {
		const { repo, where } = setup();
		await repo.findIdentitiesByPhone({ phoneNumber: '0901' });
		expect(where()).toEqual({ deletedAt: null, phoneNumber: { contains: '0901' } });
	});
});
