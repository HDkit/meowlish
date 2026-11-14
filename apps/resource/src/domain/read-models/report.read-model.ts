export interface ReportReadModel {
	id: string;
	reportedBy: string;
	type: string;
	status: string;
	title: string;
	description: string;
	targetType?: string;
	targetId?: string;
	resolvedBy?: string;
	adminResponse?: string;
	fileIds: string[];
	createdAt: string;
	updatedAt: string;
}

export interface ReportListReadModel {
	reports: ReportReadModel[];
	totalCount: number;
}
