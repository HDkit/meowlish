export type ExamManagementMinimalInfo = {
	id: string;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
	title: string;
	status: string;
	slug?: string;
};

export type ExamManagementDetailedInfo = ExamManagementMinimalInfo & {
	description?: string;
	duration: number;
	sectionIds: string[];
	tags: string[];
};
