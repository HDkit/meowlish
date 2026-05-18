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
		[Role.Mod]: [
			Permission.EXAM_WRITE,
			Permission.EXAM_REVIEW,
			Permission.USER_LOCK,
			Permission.BOOKING_VIEW_ALL,
			Permission.PAYMENT_READ,
		],
		[Role.User]: [],
		[Role.Student]: [
			Permission.COURSE_ENROLL,
			Permission.BOOKING_CREATE,
			Permission.CONNECTION_REQUEST,
			Permission.AI_PRACTICE_ACCESS,
			Permission.CHAT_ACCESS,
		],
		[Role.Parent]: [
			Permission.CONNECTION_REQUEST,
			Permission.CONNECTION_VIEW_CHILD,
			Permission.PAYMENT_READ,
		],
		[Role.Teacher]: [
			Permission.BOOKING_MANAGE_SLOTS,
			Permission.BOOKING_VIEW_ALL,
			Permission.EXAM_WRITE,
			Permission.CONNECTION_REQUEST,
			Permission.COURSE_MANAGE,
			Permission.STUDENT_VIDEO_VIEW,
			Permission.STUDENT_VIDEO_MANAGE,
			Permission.TEACHER_FEEDBACK_CREATE,
			Permission.TEACHER_FEEDBACK_VIEW,
			Permission.NOTIFICATION_SEND,
			Permission.WEEKLY_FOCUS_MANAGE,
		],
		[Role.Mentor]: [
			Permission.BOOKING_MANAGE_SLOTS,
			Permission.BOOKING_VIEW_ALL,
			Permission.EXAM_WRITE,
			Permission.EXAM_REVIEW,
			Permission.CONNECTION_REQUEST,
			Permission.COURSE_MANAGE,
			Permission.STUDENT_VIDEO_VIEW,
			Permission.STUDENT_VIDEO_MANAGE,
			Permission.TEACHER_FEEDBACK_CREATE,
			Permission.TEACHER_FEEDBACK_VIEW,
			Permission.NOTIFICATION_SEND,
			Permission.WEEKLY_FOCUS_MANAGE,
		],
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

	const studentRole = await prisma.role.findFirstOrThrow({
		where: { name: Role.Student },
	});

	const identity = await prisma.identity.upsert({
		where: { username: 'admin' },
		update: {},
		create: {
			id: 'admin',
			version: 1,
			username: 'admin',
			fullName: 'Admin',
		},
	});

	await prisma.credential.upsert({
		where: {
			identifier_loginType: {
				identifier: 'admin@gmail.com',
				loginType: LoginType.Mail,
			},
		},
		update: {
			secretHash: passwordHash,
		},
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

	await prisma.identityRole.upsert({
		where: {
			identityId_roleId: {
				identityId: identity.id,
				roleId: studentRole.id,
			},
		},
		update: {},
		create: {
			identityId: identity.id,
			roleId: studentRole.id,
		},
	});
}

const SEED_USERS = [
	{ id: '8ac3508e-d8bc-425f-9b4d-04461d9bd0ec', username: 'minh.nguyen', fullName: 'Nguyễn Văn Minh' },
	{ id: '4292d890-805f-4fca-b007-8ce887d87f3d', username: 'linh.tran', fullName: 'Trần Thị Linh' },
	{ id: 'f5553ed6-6eac-4be8-af62-fbb4226f2e9f', username: 'duc.le', fullName: 'Lê Hoàng Đức' },
	{ id: '2261ce28-2f42-4420-b5af-580f8d4b8abe', username: 'hoa.pham', fullName: 'Phạm Thu Hoa' },
	{ id: '3a2fbb54-984f-4318-bff0-218dc2a9f12c', username: 'tuan.vo', fullName: 'Võ Anh Tuấn' },
	{ id: 'c14da81d-0fee-4520-b2ff-fe80141d786e', username: 'mai.do', fullName: 'Đỗ Ngọc Mai' },
	{ id: '0833eda1-18e0-4f74-b774-158cea662100', username: 'khoa.bui', fullName: 'Bùi Đăng Khoa' },
	{ id: 'ff8aafa4-7715-4806-9d29-a46807de020d', username: 'thao.hoang', fullName: 'Hoàng Phương Thảo' },
	{ id: '70b51742-b20a-43bf-9a5c-6d7c9aef7bba', username: 'nam.dang', fullName: 'Đặng Thành Nam' },
];

async function seedTestUsers() {
	const studentRole = await prisma.role.findFirstOrThrow({
		where: { name: Role.Student },
	});
	const passwordHash = await bcrypt.hash('test123', 10);

	for (const user of SEED_USERS) {
		let identity = await prisma.identity.findUnique({ where: { id: user.id } });
		if (identity) {
			identity = await prisma.identity.update({
				where: { id: user.id },
				data: { fullName: user.fullName },
			});
		} else {
			identity = await prisma.identity.upsert({
				where: { username: user.username },
				update: { fullName: user.fullName },
				create: {
					id: user.id,
					version: 1,
					username: user.username,
					fullName: user.fullName,
				},
			});
		}

		await prisma.credential.upsert({
			where: {
				identityId_loginType: {
					identityId: identity.id,
					loginType: LoginType.Mail,
				},
			},
			update: {},
			create: {
				identityId: identity.id,
				identifier: `${user.username}@test.com`,
				loginType: LoginType.Mail,
				secretHash: passwordHash,
			},
		});

		await prisma.identityRole.upsert({
			where: {
				identityId_roleId: {
					identityId: identity.id,
					roleId: studentRole.id,
				},
			},
			update: {},
			create: {
				identityId: identity.id,
				roleId: studentRole.id,
			},
		});
	}
	console.log(`Seeded ${SEED_USERS.length} test users`);
}

async function main() {
	await seedPermissions();
	await seedRoles();
	await seedRolePermissions();
	await seedAdminUser();
	await seedTestUsers();
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
