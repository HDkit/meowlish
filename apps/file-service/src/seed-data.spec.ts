import { buildSeedRows } from '../prisma/seed-data';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('file-service seed rows', () => {
	it('marks every seeded file as a system file', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
		fs.mkdirSync(path.join(dir, 'sub'));
		fs.writeFileSync(path.join(dir, 'SYSTEM_1.jpg'), 'x');
		fs.writeFileSync(path.join(dir, 'sub', 'SYSTEM_q1.mp3'), 'x');
		try {
			const rows = buildSeedRows(dir);
			expect(rows.map(r => r.id).sort()).toEqual(['SYSTEM_1.jpg', 'SYSTEM_q1.mp3']);
			expect(rows.every(r => r.isSystem === true)).toBe(true);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
