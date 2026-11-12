import { FileService } from './file.service';

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
