import { FileService } from '../../../app/services/file.service';
import { BadRequestException } from '@nestjs/common';

const setup = (ownedByUser: string[] = []) => {
	const repo = {
		create: jest.fn().mockResolvedValue('new-id'),
		findIdsUploadedBy: jest.fn().mockResolvedValue(ownedByUser),
	};
	const minio = {};
	const signing = {
		presignedPostPolicy: jest.fn().mockResolvedValue({ postURL: 'u', formData: {} }),
	};
	const config = { getOrThrow: jest.fn().mockReturnValue({}) };
	const service = new FileService(minio as never, repo as never, config as never);
	Object.assign(service, { signingClient: signing });
	return { repo: repo, service: service };
};

describe('FileService uploader ownership', () => {
	it('records the uploader when a presigned upload URL is issued', async () => {
		const { repo, service } = setup();
		await service.getPresignedUrl(
			{ fileName: 'a.png', fileSize: 10, contentType: 'image/png' },
			true,
			'user-1',
		);
		expect(repo.create).toHaveBeenCalledWith(
			{ fileName: 'a.png', fileSize: 10, contentType: 'image/png' },
			true,
			'user-1',
		);
	});

	it('reports ok when every file was uploaded by the user', async () => {
		const { repo, service } = setup(['f1', 'f2']);
		await expect(service.checkFilesOwnedBy(['f1', 'f2', 'f1'], 'user-1')).resolves.toEqual({
			ok: true,
			foreignIds: [],
		});
		expect(repo.findIdsUploadedBy).toHaveBeenCalledWith(['f1', 'f2'], 'user-1');
	});

	it('lists files uploaded by someone else, legacy files and unknown ids as foreign', async () => {
		const { service } = setup(['f1']);
		await expect(service.checkFilesOwnedBy(['f1', 'theirs', 'legacy'], 'user-1')).resolves.toEqual({
			ok: false,
			foreignIds: ['theirs', 'legacy'],
		});
	});

	it('is ok for an empty list without touching the database', async () => {
		const { repo, service } = setup();
		await expect(service.checkFilesOwnedBy([], 'user-1')).resolves.toEqual({
			ok: true,
			foreignIds: [],
		});
		expect(repo.findIdsUploadedBy).not.toHaveBeenCalled();
	});
});

describe('FileService presigned upload', () => {
	it('expires the upload URL after 15 minutes', async () => {
		const { service } = setup();
		const policySpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
		const signing = (service as unknown as { signingClient: { presignedPostPolicy: jest.Mock } })
			.signingClient;
		await service.getPresignedUrl(
			{ fileName: 'a.png', fileSize: 10, contentType: 'image/png' },
			true,
			'user-1',
		);
		policySpy.mockRestore();
		const policy = (signing.presignedPostPolicy.mock.calls as [unknown][])[0][0] as {
			policy: { expiration: string };
		};
		expect(policy.policy.expiration).toBe(new Date(1_000_000 + 15 * 60 * 1000).toISOString());
	});

	it('signs for the id of the freshly created row, never a client-supplied key', async () => {
		const { service, repo } = setup();
		repo.create.mockResolvedValueOnce('fresh-id');
		const signing = (service as unknown as { signingClient: { presignedPostPolicy: jest.Mock } })
			.signingClient;
		const res = await service.getPresignedUrl(
			{ fileName: 'SYSTEM_x.png', fileSize: 10, contentType: 'image/png' },
			true,
			'user-1',
		);
		const policy = (signing.presignedPostPolicy.mock.calls as [unknown][])[0][0] as {
			formData: { key: string };
		};
		expect(policy.formData.key).toBe('fresh-id');
		expect(res.id).toBe('fresh-id');
	});
});

describe('FileService.removeObjects', () => {
	const setup = (results: Record<string, unknown[]> = {}) => {
		const minio = {
			removeObjects: jest.fn((bucket: string) => Promise.resolve(results[bucket] ?? [])),
		};
		const config = { getOrThrow: jest.fn().mockReturnValue({}) };
		const service = new FileService(minio as never, {} as never, config as never);
		return { minio: minio, service: service };
	};
	const files = [
		{ id: 'pub', isPublic: true },
		{ id: 'priv', isPublic: false },
		{ id: 'priv2', isPublic: false },
	];

	it('deletes each object from its bucket and reports every id as removed', async () => {
		const { minio, service } = setup();
		await expect(service.removeObjects(files)).resolves.toEqual(['pub', 'priv', 'priv2']);
		expect(minio.removeObjects).toHaveBeenCalledWith('public', ['pub']);
		expect(minio.removeObjects).toHaveBeenCalledWith('private', ['priv', 'priv2']);
	});

	it('leaves out the ids whose delete the storage rejected', async () => {
		// minio-js returns the per-key <Error> entries of the DeleteObjects response.
		const { service } = setup({
			private: [
				{ Code: 'AccessDenied', Key: 'priv' },
				{ Error: { Code: 'InternalError', Key: 'priv2' } },
			],
		});
		await expect(service.removeObjects(files)).resolves.toEqual(['pub']);
	});

	it('skips a bucket with nothing to delete', async () => {
		const { minio, service } = setup();
		await service.removeObjects([{ id: 'pub', isPublic: true }]);
		expect(minio.removeObjects).toHaveBeenCalledTimes(1);
	});

	it('propagates a failed storage request', async () => {
		const { minio, service } = setup();
		minio.removeObjects.mockRejectedValueOnce(new Error('minio down'));
		await expect(service.removeObjects(files)).rejects.toThrow('minio down');
	});
});

describe('FileService.getPresignedUrl validation', () => {
	it.each([
		['too large', { fileName: 'a.png', fileSize: 11 * 1024 * 1024, contentType: 'image/png' }],
		[
			'disallowed type',
			{ fileName: 'a.exe', fileSize: 10, contentType: 'application/x-msdownload' },
		],
		['zero-byte', { fileName: 'a.png', fileSize: 0, contentType: 'image/png' }],
		['negative-size', { fileName: 'a.png', fileSize: -5, contentType: 'image/png' }],
		['fractional-size', { fileName: 'a.png', fileSize: 1.5, contentType: 'image/png' }],
	])('rejects a %s file with 400 before inserting a row', async (_name, metadata) => {
		const { repo, service } = setup();
		await expect(service.getPresignedUrl(metadata, true, 'user-1')).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(repo.create).not.toHaveBeenCalled();
	});
});
