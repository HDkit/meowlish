import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// C5: deleting an exam cascades exam → sections → questions / attempts → attempt_responses; the
// scorer_data FK must cascade too, or the delete fails once any writing has AI feedback.
const prismaDir = path.join(__dirname, '../../../prisma');

describe('scorer_data → attempt_responses FK (C5)', () => {
	it('the schema declares ON DELETE CASCADE', () => {
		const schema = readFileSync(path.join(prismaDir, 'schema/exam-practice.prisma'), 'utf8');
		const scorerData = /model ScorerData \{[^}]*\}/.exec(schema)?.[0] ?? '';
		expect(scorerData).toMatch(
			/response\s+AttemptResponse\s+@relation\(fields: \[responseId\], references: \[id\], onDelete: Cascade\)/,
		);
	});

	it('the latest migration touching the FK recreates it with ON DELETE CASCADE', () => {
		const migrationsDir = path.join(prismaDir, 'migrations');
		const lastDefinition = readdirSync(migrationsDir)
			.filter(d => /^\d+_/.test(d))
			.sort()
			.map(d => readFileSync(path.join(migrationsDir, d, 'migration.sql'), 'utf8'))
			.flatMap(sql => sql.split(';'))
			.filter(stmt => /ADD CONSTRAINT "scorer_data_response_id_fkey"/.test(stmt))
			.at(-1);
		expect(lastDefinition).toMatch(/ON DELETE CASCADE/);
	});
});
