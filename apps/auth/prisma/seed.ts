import { LoginType } from '../src/enums/login-type.enum';
import { PrismaClient } from '@prisma-client/auth';
import { Permission, Role } from '@server/typing';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedPermissions() {
	const permissions = Object.values(Permission);

	await prisma.permission.createMany({
		data: permissions.map(p => ({ name: p })),
		skipDuplicates: true,
	});
}

async function seedRoles() {
	const roles = Object.values(Role);

	await prisma.role.createMany({
		data: roles.map(r => ({ name: r })),
		skipDuplicates: true,
	});
}

async function seedRolePermissions() {
	const permissions = await prisma.permission.findMany();
	const permissionMap = new Map(permissions.map(p => [p.name, p.id]));

	const roles = await prisma.role.findMany();
	const roleMap = new Map(roles.map(r => [r.name, r.id]));

	const rolePermissions: Record<Role, Permission[]> = {
		[Role.Admin]: Object.values(Permission),
		[Role.Mod]: [Permission.EXAM_WRITE, Permission.EXAM_REVIEW, Permission.USER_LOCK],
		[Role.User]: [],
	};

	for (const [roleName, perms] of Object.entries(rolePermissions) as [Role, Permission[]][]) {
		const roleId = roleMap.get(roleName);

		if (!roleId) throw new Error(`Role not found: ${roleName}`);

		for (const perm of perms) {
			const permissionId = permissionMap.get(perm);

			if (!permissionId) throw new Error('Permission not found');

			await prisma.rolePermission.upsert({
				where: {
					roleId_permissionId: {
						roleId: roleId,
						permissionId: permissionId,
					},
				},
				update: {},
				create: {
					roleId: roleId,
					permissionId: permissionId,
				},
			});
		}
	}
}

async function seedAdminUser() {
	const passwordHash = await bcrypt.hash('admin', 10);

	const adminRole = await prisma.role.findFirstOrThrow({
		where: { name: Role.Admin },
	});

	const identity = await prisma.identity.upsert({
		where: { username: 'admin' },
		update: {},
		create: {
			id: 'admin-id',
			version: 1,
			username: 'admin',
		},
	});

	await prisma.credential.upsert({
		where: {
			identifier_loginType: {
				identifier: 'admin@gmail.com',
				loginType: LoginType.Mail,
			},
		},
		update: {},
		create: {
			identityId: identity.id,
			identifier: 'admin@gmail.com',
			loginType: LoginType.Mail,
			secretHash: passwordHash,
		},
	});

	await prisma.identityRole.upsert({
		where: {
			identityId_roleId: {
				identityId: identity.id,
				roleId: adminRole.id,
			},
		},
		update: {},
		create: {
			identityId: identity.id,
			roleId: adminRole.id,
		},
	});
}

async function main() {
	await seedPermissions();
	await seedRoles();
	await seedRolePermissions();
	await seedAdminUser();
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
