import fs from 'fs';
import mime from 'mime-types';
import path from 'path';

function getAllFiles(dir: string): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	let files: string[] = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files = files.concat(getAllFiles(fullPath));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

/** Rows for every file under `rootMediaDir`. All of them are platform media: `isSystem`. */
export function buildSeedRows(rootMediaDir: string) {
	const files = getAllFiles(rootMediaDir);
	const data = files.map(filePath => {
		const stats = fs.statSync(filePath);
		const mimeType = mime.lookup(filePath) || 'application/octet-stream';
		const name = path.parse(filePath).base;
		return {
			id: name,
			name: name,
			size: stats.size,
			mimeType: mimeType,
			refCount: 1,
			isPublic: true,
			isSystem: true,
		};
	});
	return data;
}
