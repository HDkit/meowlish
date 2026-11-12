#!/usr/bin/env node
// Create placeholder media for every file id the seeds reference (e.g. the
// exam seeds' `fileId: 'SYSTEM_q5.mp3'`), write them to
// apps/file-service/eng-media (what the file-service seed indexes), and upload
// them to MinIO's public bucket so the URLs the API hands out actually resolve.
//
//   node scripts/dev-media/generate.mjs            # generate + upload
//   node scripts/dev-media/generate.mjs --no-upload
//
// Uses ffmpeg (labelled images, audio) and espeak-ng (spoken labels) when they
// are installed; otherwise copies the tiny fallback.jpg / fallback.mp3 here.
// Existing files in eng-media are kept, so real media can be dropped in.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'apps', 'file-service', 'eng-media');
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

const ids = referencedIds();
mkdirSync(OUT, { recursive: true });
let created = 0;
for (const id of ids) {
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
console.log(
	`eng-media: ${ids.length} referenced, ${created} generated (${
		FFMPEG ?
			ESPEAK ? 'ffmpeg+espeak-ng'
			:	'ffmpeg'
		:	'fallback files'
	}) -> ${OUT}`,
);

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
	console.log(`minio: uploaded ${files.length} objects to bucket "${BUCKET}"`);
}
