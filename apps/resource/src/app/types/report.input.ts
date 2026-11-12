import { type PageInput } from './pagination';

export interface CreateReportInput {
	reportedBy: string;
	type: string;
	title: string;
	description: string;
	targetType?: string;
	targetId?: string;
	fileIds: string[];
}

export interface UpdateReportInput {
	id: string;
	status?: string;
	resolvedBy?: string;
	adminResponse?: string;
}

export interface ListReportsInput extends PageInput {
	reportedBy?: string;
	type?: string;
	status?: string;
	targetType?: string;
	targetId?: string;
}
