import { FILE_CLIENT } from '../../../../constants/file';
import { SectionManagementInfo } from '../../../../domain/read-models/management/section-info.read-model';
import {
	type IManagementReadRepository,
	IManagementReadRepositoryToken,
} from '../../../../domain/repositories/management.read.repository';
import { GetSectionManagementDetailsQuery } from '../../management/exam.get-section-details.query';
import {
	Inject,
	NotFoundException,
	OnModuleInit,
	ServiceUnavailableException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ClientGrpc } from '@nestjs/microservices';
import { file } from '@server/generated';
import { firstValueFrom } from 'rxjs';

@QueryHandler(GetSectionManagementDetailsQuery)
export class GetSectionManagementDetailsQueryHandler
	implements IQueryHandler<GetSectionManagementDetailsQuery>, OnModuleInit
{
	private fileService!: file.FileServiceClient;

	onModuleInit() {
		this.fileService = this.fileClient.getService<file.FileServiceClient>(file.FILE_SERVICE_NAME);
	}
	constructor(
		@Inject(IManagementReadRepositoryToken)
		private readonly managementReadRepository: IManagementReadRepository,
		@Inject(FILE_CLIENT) private readonly fileClient: ClientGrpc,
	) {}

	async execute(query: GetSectionManagementDetailsQuery): Promise<SectionManagementInfo> {
		const payload = query.payload;
		const section = await this.managementReadRepository.getSectionDetail(payload.sectionId);

		if (!section) throw new NotFoundException('Section not found');

		try {
			const urlMap = await firstValueFrom(
				this.fileService.getUrls({ ids: section.files.map(f => f.id) }),
			);
			section.files.forEach(f => (f.url = urlMap.urls[f.id]));
		} catch {
			throw new ServiceUnavailableException('Cannot access File sub-service');
		}
		return section;
	}
}
