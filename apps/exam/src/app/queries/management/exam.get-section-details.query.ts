import { SectionManagementInfo } from '../../../domain/read-models/management/section-info.read-model';
import { Query } from '@server/utils';

export class GetSectionManagementDetailsQuery extends Query<
	SectionManagementInfo,
	{ sectionId: string }
> {}
