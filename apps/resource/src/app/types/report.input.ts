import { type ReportStatus } from '../../enums/report-status.enum';
import { type PageInput } from './pagination';

export interface CreateReportInput {
	reportedBy: string;
	type: string;
	title: string;
	description: string;
	targetType?: string;
	targetId?: string;
	fileIds: string[];
	/** Admins may attach files someone else uploaded (decided by the gateway). */
	mayAttachAnyFile?: boolean;
}

export interface UpdateReportInput {
	id: string;
	status?: ReportStatus;
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
