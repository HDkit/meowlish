#!/usr/bin/env node
// Build apps/file-service/eng-media (what the file-service seed indexes) and upload it to
// MinIO's public bucket so the URLs the API hands out resolve:
//   1. copy the real exam media from scripts/eng-media/<exam>/{audio,images} (Git LFS);
//   2. generate placeholders for any file id the seeds reference (e.g. the exam seeds'
//      `fileId: 'SYSTEM_q5.mp3'`) that has no real file;
//   3. delete outputs that are neither real media nor referenced (stale placeholders).
//
//   node scripts/dev-media/generate.mjs            # build + upload
//   node scripts/dev-media/generate.mjs --no-upload
//
// Placeholders use ffmpeg (labelled images, audio) and espeak-ng (spoken labels) when they are
// installed; otherwise the tiny fallback.jpg / fallback.mp3 here. Real files that are still Git
// LFS pointers (cloned without `git lfs pull`) are skipped with a warning and get placeholders.
import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
	rmSync,
	statSync,
	closeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'apps', 'file-service', 'eng-media');
const REAL = join(ROOT, 'scripts', 'eng-media');
const MEDIA_EXT = /\.(mp3|wav|m4a|ogg|jpe?g|png)$/i;
const BUCKET = 'public'; // FileService.MINIO_PUBLIC_BUCKET_NAME
const upload = !process.argv.includes('--no-upload');

const has = (cmd, flag) => {
	try {
		execFileSync(cmd, [flag], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};
const FFMPEG = has('ffmpeg', '-version');
const ESPEAK = FFMPEG && has('espeak-ng', '--version');

/** every `fileId: '...'` literal in the prisma seed sources */
function referencedIds() {
	const files = [];
	const walk = dir => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (/\.ts$/.test(e.name)) files.push(p);
		}
	};
	for (const app of readdirSync(join(ROOT, 'apps'))) {
		const seedDir = join(ROOT, 'apps', app, 'prisma');
		if (existsSync(seedDir)) walk(seedDir);
	}
	const ids = new Set();
	for (const f of files) {
		for (const m of readFileSync(f, 'utf8').matchAll(/fileId:\s*'([^']+)'/g)) ids.add(m[1]);
	}
	return [...ids].sort();
}

/** "SYSTEM_q41-43.mp3" -> "Questions 41 to 43" etc. */
function spokenLabel(id) {
	const base = id.replace(/^SYSTEM_/, '').replace(/\.[^.]+$/, '');
	let m;
	if ((m = base.match(/^q(\d+)-(\d+)$/)))
		return `Placeholder audio for questions ${m[1]} to ${m[2]}.`;
	if ((m = base.match(/^q(\d+)$/))) return `Placeholder audio for question ${m[1]}.`;
	if ((m = base.match(/^sim_(\d+)$/))) return `Placeholder listening recording ${m[1]}.`;
	return `Placeholder audio ${base.replace(/[_-]/g, ' ')}.`;
}

function makeImage(id, dest) {
	if (!FFMPEG) return copyFileSync(join(HERE, 'fallback.jpg'), dest);
	const text = id.replace(/'/g, '').replace(/:/g, '\\:');
	execFileSync('ffmpeg', [
		'-loglevel',
		'error',
		'-y',
		'-f',
		'lavfi',
		'-i',
		'color=c=0xe8f5ee:s=800x500',
		'-vf',
		`drawtext=text='${text}':fontsize=40:fontcolor=0x1f6f4a:x=(w-text_w)/2:y=(h-text_h)/2`,
		'-frames:v',
		'1',
		dest,
	]);
}

function makeAudio(id, dest) {
	if (!FFMPEG) return copyFileSync(join(HERE, 'fallback.mp3'), dest);
	if (ESPEAK) {
		const wav = join(tmpdir(), `dev-media-${process.pid}.wav`);
		execFileSync('espeak-ng', ['-w', wav, spokenLabel(id)]);
		execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-b:a', '48k', dest]);
		rmSync(wav, { force: true });
	} else {
		execFileSync('ffmpeg', [
			'-loglevel',
			'error',
			'-y',
			'-f',
			'lavfi',
			'-i',
			'sine=frequency=440:duration=2',
			'-b:a',
			'48k',
			dest,
		]);
	}
}

/** A file checked out without `git lfs pull` is a small text pointer, not media. */
function isLfsPointer(path) {
	if (statSync(path).size > 1024) return false;
	const fd = openSync(path, 'r');
	const buf = Buffer.alloc(64);
	readSync(fd, buf, 0, 64, 0);
	closeSync(fd);
	return buf.toString('utf8').startsWith('version https://git-lfs');
}

/** real media by file name, from scripts/eng-media/<exam>/{audio,images}/ */
function realMedia() {
	const found = new Map();
	if (!existsSync(REAL)) return found;
	const walk = dir => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (MEDIA_EXT.test(e.name)) {
				if (found.has(e.name)) console.warn(`  duplicate media name ${e.name}: using ${found.get(e.name)}`);
				else found.set(e.name, p);
			}
		}
	};
	walk(REAL);
	return found;
}

const ids = referencedIds();
const real = realMedia();
mkdirSync(OUT, { recursive: true });
let copied = 0;
let pointers = 0;
for (const [name, src] of real) {
	if (isLfsPointer(src)) {
		pointers++;
		real.delete(name);
		continue;
	}
	copyFileSync(src, join(OUT, name));
	copied++;
}
if (pointers > 0) console.warn(`  ${pointers} media files are Git LFS pointers; run \`git lfs pull\``);

let created = 0;
for (const id of ids) {
	if (real.has(id)) continue;
	const dest = join(OUT, id);
	if (existsSync(dest)) continue;
	const ext = extname(id).toLowerCase();
	if (['.jpg', '.jpeg', '.png'].includes(ext)) makeImage(id, dest);
	else if (['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) makeAudio(id, dest);
	else {
		console.warn(`  skip ${id}: no generator for ${ext}`);
		continue;
	}
	created++;
}

const keep = new Set([...real.keys(), ...ids]);
let pruned = 0;
for (const name of readdirSync(OUT)) {
	if (keep.has(name)) continue;
	rmSync(join(OUT, name), { force: true });
	pruned++;
}
const missing = ids.filter(id => !real.has(id));
console.log(
	`eng-media: ${copied} real files, ${ids.length} referenced, ${created} placeholders generated (${
		FFMPEG ?
			ESPEAK ? 'ffmpeg+espeak-ng'
			:	'ffmpeg'
		:	'fallback files'
	}), ${pruned} stale removed -> ${OUT}`,
);
if (missing.length > 0) console.warn(`  referenced without real media: ${missing.join(', ')}`);

if (upload) {
	const Minio = await import('minio');
	const client = new Minio.Client({
		endPoint: process.env.MINIO_HOST ?? 'localhost',
		port: Number(process.env.MINIO_PORT ?? 9000),
		useSSL: process.env.MINIO_USE_SSL === 'true',
		accessKey: process.env.MINIO_USER ?? process.env.MINIO_ROOT_USER ?? 'minio',
		secretKey: process.env.MINIO_PASSWORD ?? process.env.MINIO_ROOT_PASSWORD ?? 'minio123',
	});
	if (!(await client.bucketExists(BUCKET))) await client.makeBucket(BUCKET);
	// same anonymous read-only policy file-service applies on startup
	await client.setBucketPolicy(
		BUCKET,
		JSON.stringify({
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Principal: { AWS: ['*'] },
					Action: ['s3:GetObject'],
					Resource: [`arn:aws:s3:::${BUCKET}/*`],
				},
			],
		}),
	);
	const files = readdirSync(OUT);
	for (const name of files) await client.fPutObject(BUCKET, name, join(OUT, name));
	// Drop stale seed media (SYSTEM_* only: the bucket also holds user uploads).
	const current = new Set(files);
	const stale = [];
	for await (const obj of client.listObjectsV2(BUCKET, 'SYSTEM_', false)) {
		if (obj.name && !current.has(obj.name)) stale.push(obj.name);
	}
	if (stale.length > 0) await client.removeObjects(BUCKET, stale);
	console.log(
		`minio: uploaded ${files.length} objects to bucket "${BUCKET}", removed ${stale.length} stale`,
	);
}
