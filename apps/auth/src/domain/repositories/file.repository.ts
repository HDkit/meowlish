export interface IFileRepository {
	getAndRemoveDeletedFileIds(limit?: number): Promise<{ id: string; count: number }[]>;
}

export const IFileRepositoryToken = Symbol('IFileRepository');
