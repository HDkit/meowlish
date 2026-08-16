import { FilePreviewInfo } from './file-preview.read-model';

export type SectionManagementInfo = {
	id: string;
	examId: string;
	parentId?: string;
	name?: string;
	directive: string;
	contentType: string;
	childrenIds: string[];
	files: FilePreviewInfo[];
	tags: string[];
};
