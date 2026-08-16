import { FileMetadata } from '../../types/file-metadata.type';

export interface IFileRepository {
	// returns id
	create(fileMetadata: FileMetadata, isPublic: boolean): Promise<string>;
	incrementRef(ids: string[], count?: number): Promise<void>;
	decrementRef(files: { id: string; count?: number }[]): Promise<void>;
	remove(ids: string[]): Promise<void>;
	getOrphanedFiles(): Promise<{ id: string; isPublic: boolean; updatedAt: Date }[]>;
	getFilesPravicySettings(ids: string[]): Promise<{ id: string; isPublic: boolean }[]>;
}

export const IFileRepositoryToken = Symbol('IFileRepository');
