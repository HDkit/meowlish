import { TagNode } from '../read-models/tag/tag-node.read-model';
import { TagTree } from '../read-models/tag/tag-trees.read-model';

export interface ITagReadRepository {
	getTagTree(): Promise<TagTree[]>;
	getTagList(): Promise<TagNode[]>;
}

export const ITagReadRepositoryToken = Symbol('ITagReadRepository');
