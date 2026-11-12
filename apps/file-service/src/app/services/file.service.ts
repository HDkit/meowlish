import { IEnvVars } from '../../configs/config';
import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../domain/repositories/file.repository';
import { FileMetadata } from '../../types/file-metadata.type';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, PostPolicy } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';

@Injectable()
export class FileService implements OnModuleInit {
	private readonly MINIO_PUBLIC_BUCKET_NAME = 'public';
	private readonly MINIO_PRIVATE_BUCKET_NAME = 'private';
	private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
	private readonly ALLOWED_MIME_TYPES = [
		'image/jpeg',
		'image/png',
		'application/pdf',
		'video/mp4',
		'audio/mpeg',
	];

	/**
	 * Client used only to sign URLs handed to browsers. A presigned URL's signature
	 * covers its host, so it must be signed for the address the browser will use
	 * (MINIO_PUBLIC_URL), not the internal one (e.g. `min-io` inside docker).
	 * Signing is local; the fixed region avoids a region lookup request.
	 */
	private readonly signingClient: Client;

	constructor(
		@Inject(MINIO_CONNECTION) private readonly minioClient: Client,
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		this.signingClient = this.createSigningClient();
	}

	private createSigningClient(): Client {
		const minioEnvs = this.configService.getOrThrow('objStorage', { infer: true });
		if (!minioEnvs.publicUrl) return this.minioClient;

		const url = new URL(minioEnvs.publicUrl);
		const useSSL = url.protocol === 'https:';
		return new Client({
			endPoint: url.hostname,
			port:
				url.port ? Number(url.port)
				: useSSL ? 443
				: 80,
			useSSL: useSSL,
			accessKey: minioEnvs.user,
			secretKey: minioEnvs.password,
			region: 'us-east-1',
		});
	}

	async onModuleInit() {
		// PUBLIC BUCKET
		try {
			await this.minioClient.makeBucket(this.MINIO_PUBLIC_BUCKET_NAME);
		} catch (err: unknown) {
			if (
				typeof err === 'object' &&
				err !== null &&
				'code' in err &&
				((err as { code: string }).code === 'BucketAlreadyOwnedByYou' ||
					(err as { code: string }).code === 'BucketAlreadyExists')
			) {
				// bucket already exists, safe to ignore
			} else {
				throw err;
			}
		}

		// PRIVATE BUCKET
		try {
			await this.minioClient.makeBucket(this.MINIO_PRIVATE_BUCKET_NAME);
		} catch (err: unknown) {
			if (
				typeof err === 'object' &&
				err !== null &&
				'code' in err &&
				((err as { code: string }).code === 'BucketAlreadyOwnedByYou' ||
					(err as { code: string }).code === 'BucketAlreadyExists')
			) {
				// ignore
			} else {
				throw err;
			}
		}

		const publicReadPolicy = {
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Principal: { AWS: ['*'] }, // everyone
					Action: ['s3:GetObject'], // only allow reading objects
					Resource: [`arn:aws:s3:::${this.MINIO_PUBLIC_BUCKET_NAME}/*`], // all objects in bucket
				},
			],
		};

		await this.minioClient.setBucketPolicy(
			this.MINIO_PUBLIC_BUCKET_NAME,
			JSON.stringify(publicReadPolicy),
		);
	}

	async getPresignedUrl(
		fileMetadata: FileMetadata,
		isPublic: boolean,
		uploadedBy: string,
	): Promise<{
		id: string;
		uploadUrl: string;
		formData: Record<string, string>;
		fileName: string;
	}> {
		const id = await this.fileRepository.create(fileMetadata, isPublic, uploadedBy);

		if (fileMetadata.fileSize > this.MAX_FILE_SIZE) {
			throw new Error(`File is too large. Maximum allowed size is 10MB.`);
		}

		if (!this.ALLOWED_MIME_TYPES.includes(fileMetadata.contentType)) {
			throw new Error(`Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`);
		}

		// Create POST policy
		const policy = new PostPolicy();
		policy.setBucket(isPublic ? this.MINIO_PUBLIC_BUCKET_NAME : this.MINIO_PRIVATE_BUCKET_NAME);
		policy.setKey(id);
		policy.setContentLengthRange(1, fileMetadata.fileSize);
		// TODO: Find a way to actually enforce contentType with signed url
		// DOES NOT ACTUALLY VALIDATE THE OBJECT CONTENT TYPE, JUST THE HEADER. CLIENT MUST PARSE CAREFULLY IG CUZ I DO NOT HAVE TIME FOR THIS YET
		policy.setContentType(fileMetadata.contentType);

		// Generate presigned POST
		const presigned = await this.signingClient.presignedPostPolicy(policy);

		return {
			id: id,
			uploadUrl: presigned.postURL,
			formData: presigned.formData,
			fileName: fileMetadata.fileName,
		};
	}

	async deleteFiles(files: { id: string; isPublic: boolean }[]): Promise<void> {
		const grouped = Object.groupBy(files, f => (f.isPublic ? 'public' : 'private'));
		await this.fileRepository.remove(files.map(f => f.id));
		await this.minioClient.removeObjects(
			this.MINIO_PUBLIC_BUCKET_NAME,
			grouped.public?.map(f => f.id) ?? [],
		);
		await this.minioClient.removeObjects(
			this.MINIO_PRIVATE_BUCKET_NAME,
			grouped.private?.map(f => f.id) ?? [],
		);
	}

	/**
	 *
	 * @returns An object mapping file id to the correct url, if the file could not be found
	 *  Missing files are NOT included.
	 */
	async getFilesUrls(ids: string[]): Promise<Record<string, string>> {
		const minioEnvs = this.configService.getOrThrow('objStorage', { infer: true });
		const env = this.configService.getOrThrow('env', { infer: true });
		// Absolute URL (scheme included) so browsers don't treat it as a relative path.
		const publicBase = (
			minioEnvs.publicUrl ??
			`${(minioEnvs.useSSL ?? env === 'production') ? 'https' : 'http'}://${minioEnvs.host}${minioEnvs.port ? `:${minioEnvs.port}` : ''}`
		).replace(/\/+$/, '');
		const filesPrivacySettings = await this.fileRepository.getFilesPravicySettings(ids);
		const grouped = Object.groupBy(filesPrivacySettings, f => (f.isPublic ? 'public' : 'private'));
		const idMap: Record<string, string> = {};
		(grouped.public || []).forEach(f => {
			idMap[f.id] = `${publicBase}/${this.MINIO_PUBLIC_BUCKET_NAME}/${f.id}`;
		});
		await Promise.all(
			(grouped.private || []).map(async f => {
				idMap[f.id] = await this.signingClient.presignedGetObject(
					this.MINIO_PRIVATE_BUCKET_NAME,
					f.id,
					60 * 5,
				);
			}),
		);
		return idMap;
	}

	/**
	 * Files not uploaded by `userId` are foreign: someone else's uploads, legacy/seeded/system
	 * files with no recorded uploader, and unknown ids. Callers refuse to attach foreign files.
	 */
	async checkFilesOwnedBy(
		fileIds: string[],
		userId: string,
	): Promise<{ ok: boolean; foreignIds: string[] }> {
		const ids = [...new Set(fileIds)];
		if (ids.length === 0) return { ok: true, foreignIds: [] };
		const owned = new Set(await this.fileRepository.findIdsUploadedBy(ids, userId));
		const foreignIds = ids.filter(id => !owned.has(id));
		return { ok: foreignIds.length === 0, foreignIds: foreignIds };
	}
}
