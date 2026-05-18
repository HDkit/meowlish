/**
 * Migration script: engapp-v2 → server auth
 *
 * Usage:
 *   1. Export engapp-v2 data:
 *      Run the SQL below against the engapp-v2 Neon PostgreSQL and save as engapp-v2-export.json
 *
 *   2. Run this script:
 *      npx tsx apps/auth/prisma/migrate-engapp.ts --input ./engapp-v2-export.json
 *
 * Export SQL (run via psql or Neon SQL Editor):
 *
 *   SELECT json_build_object(
 *     'users', (SELECT json_agg(row_to_json(u)) FROM users u),
 *     'teachers', (SELECT json_agg(row_to_json(t)) FROM teachers t),
 *     'google_tokens', (
 *       SELECT json_agg(row_to_json(g))
 *       FROM teacher_google_tokens g
 *       JOIN teachers t ON t.id = g.teacher_id
 *     )
 *   );
 *
 * Or export each table individually and combine into the JSON shape below.
 */

import { PrismaClient } from '@prisma-client/auth';
import { Permission, Role } from '@server/typing';
import bcrypt from 'bcrypt';
import { readFileSync, writeFileSync } from 'fs';

// ── Types matching engapp-v2 schema ──

interface EngappUser {
	id: number;
	email: string;
	password_hash: string; // PLAINTEXT despite the name
	phone: string | null;
	full_name: string;
	role: 'student' | 'parent' | 'teacher' | 'mentor' | 'admin';
	avatar_url: string | null;
	is_locked: boolean;
	created_at: string;
	updated_at: string;
}

interface EngappTeacher {
	id: number;
	user_id: number;
	teacher_type: string | null;
	bio: string | null;
}

interface EngappGoogleToken {
	id: number;
	teacher_id: number;
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_at: string;
	scope: string | null;
	google_email: string | null;
}

interface EngappExport {
	users: EngappUser[];
	teachers: EngappTeacher[] | null;
	google_tokens: EngappGoogleToken[] | null;
}

// ── Role mapping ──

const ROLE_MAP: Record<string, Role> = {
	student: Role.Student,
	parent: Role.Parent,
	teacher: Role.Teacher,
	mentor: Role.Mentor,
	admin: Role.Admin,
};

// ── Main ──

const prisma = new PrismaClient();

async function main() {
	const inputPath = process.argv.find((_, i, arr) => arr[i - 1] === '--input') ?? 'engapp-v2-export.json';
	console.log(`Reading export from: ${inputPath}`);

	const raw = readFileSync(inputPath, 'utf-8');
	const data: EngappExport = JSON.parse(raw);

	if (!data.users?.length) {
		console.log('No users to migrate.');
		return;
	}

	// Build teacher lookup: teacher.id → user_id
	const teacherToUser = new Map<number, number>();
	for (const t of data.teachers ?? []) {
		teacherToUser.set(t.id, t.user_id);
	}

	// Build google token lookup: user_id → token
	const userGoogleTokens = new Map<number, EngappGoogleToken>();
	for (const g of data.google_tokens ?? []) {
		const userId = teacherToUser.get(g.teacher_id);
		if (userId) userGoogleTokens.set(userId, g);
	}

	// Pre-load roles from server DB
	const serverRoles = await prisma.role.findMany();
	const roleNameToId = new Map(serverRoles.map(r => [r.name, r.id]));

	const idMapping: { oldId: number; newId: string; email: string }[] = [];
	let migrated = 0;
	let skipped = 0;

	for (const user of data.users) {
		// Skip if email credential already exists
		const existingCred = await prisma.credential.findFirst({
			where: { identifier: user.email, loginType: 'mail' },
		});
		if (existingCred) {
			console.log(`  SKIP: ${user.email} (credential already exists)`);
			skipped++;
			idMapping.push({ oldId: user.id, newId: existingCred.identityId, email: user.email });
			continue;
		}

		// Hash the plaintext password
		const passwordHash = await bcrypt.hash(user.password_hash, 10);

		// Create identity
		const newId = crypto.randomUUID();
		const serverRole = ROLE_MAP[user.role];
		const roleId = serverRole ? roleNameToId.get(serverRole) : undefined;

		await prisma.$transaction(async (tx) => {
			await tx.identity.create({
				data: {
					id: newId,
					version: 1,
					username: user.email.split('@')[0] + '_' + user.id,
					fullName: user.full_name,
					phoneNumber: user.phone,
					isLocked: user.is_locked,
					avatarFileId: user.avatar_url,
					createdAt: new Date(user.created_at),
				},
			});

			await tx.credential.create({
				data: {
					identityId: newId,
					identifier: user.email,
					loginType: 'mail',
					secretHash: passwordHash,
				},
			});

			if (roleId) {
				await tx.identityRole.create({
					data: { identityId: newId, roleId: roleId },
				});
			}

			// Migrate Google Calendar token if exists
			const gToken = userGoogleTokens.get(user.id);
			if (gToken) {
				await tx.googleCalendarToken.create({
					data: {
						identityId: newId,
						accessToken: gToken.access_token,
						refreshToken: gToken.refresh_token,
						expiresAt: new Date(gToken.expires_at),
						scopes: gToken.scope ?? 'https://www.googleapis.com/auth/calendar',
					},
				});
			}
		});

		idMapping.push({ oldId: user.id, newId: newId, email: user.email });
		migrated++;
		console.log(`  OK: ${user.email} (${user.role}) → ${newId}`);
	}

	// Write ID mapping file
	const mappingPath = 'engapp-v2-id-mapping.json';
	writeFileSync(mappingPath, JSON.stringify(idMapping, null, 2));

	console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`);
	console.log(`ID mapping written to: ${mappingPath}`);
}

main()
	.catch(e => {
		console.error('Migration failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
