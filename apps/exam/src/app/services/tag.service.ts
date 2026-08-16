import { TagNode } from '../../domain/read-models/tag/tag-node.read-model';
import { TagTree } from '../../domain/read-models/tag/tag-trees.read-model';
import {
	type ITagReadRepository,
	ITagReadRepositoryToken,
} from '../../domain/repositories/tag.read.repository';
import { type ITagRepository, ITagRepositoryToken } from '../../domain/repositories/tag.repository';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TagService {
	constructor(
		@Inject(ITagRepositoryToken) private readonly tagRepository: ITagRepository,
		@Inject(ITagReadRepositoryToken) private readonly tagReadRepository: ITagReadRepository,
	) {}

	async addTag(name: string, parentId?: string): Promise<string> {
		return await this.tagRepository.addTag(name, parentId);
	}

	async deleteTag(id: string): Promise<void> {
		return await this.tagRepository.deleteTag(id);
	}

	async updateTag(id: string, name: string): Promise<void> {
		return await this.tagRepository.updateTag(id, name);
	}

	async moveTag(id: string, parentId?: string): Promise<void> {
		return await this.tagRepository.moveTag(id, parentId);
	}

	async getTagTree(): Promise<TagTree[]> {
		return await this.tagReadRepository.getTagTree();
	}

	async getTagList(): Promise<TagNode[]> {
		return await this.tagReadRepository.getTagList();
	}
}
