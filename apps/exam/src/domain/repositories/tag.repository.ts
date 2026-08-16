export interface ITagRepository {
	addTag(name: string, parentId?: string): Promise<string>;
	deleteTag(id: string): Promise<void>;
	updateTag(id: string, name: string): Promise<void>;
	moveTag(id: string, parentId?: string): Promise<void>;
}

export const ITagRepositoryToken = Symbol('ITagRepository');
