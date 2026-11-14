import { FileMetadata } from '../../types/file-metadata.type';

export interface IFileRepository {
	// returns id
	create(fileMetadata: FileMetadata, isPublic: boolean, uploadedBy: string): Promise<string>;
	/** Returns how many rows were updated (unknown or already deleted ids are skipped). */
	incrementRef(ids: string[], count?: number): Promise<number>;
	decrementRef(files: { id: string; count?: number }[]): Promise<void>;
	/**
	 * Locks (`FOR UPDATE SKIP LOCKED`) up to `limit` unreferenced, non-system files untouched
	 * since `untouchedSince`. Must run in a transaction: concurrent reference updates on the
	 * locked rows wait until it ends.
	 */
	lockOrphanedFiles(
		untouchedSince: Date,
		limit: number,
	): Promise<{ id: string; isPublic: boolean }[]>;
	/** Deletes the rows among `ids` that are still unreferenced and not system files. */
	removeOrphaned(ids: string[]): Promise<void>;
	getFilesPravicySettings(ids: string[]): Promise<{ id: string; isPublic: boolean }[]>;
	/** The subset of `ids` whose recorded uploader is `userId`. */
	findIdsUploadedBy(ids: string[], userId: string): Promise<string[]>;
}

export const IFileRepositoryToken = Symbol('IFileRepository');
