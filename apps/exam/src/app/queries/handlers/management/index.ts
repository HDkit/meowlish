import { FindExamsForManagementHandler } from './find-exams.handler';
import { GetExamManagementDetailsQueryHandler } from './get-exam-details.handler';
import { GetQuestionManagementDetailsQueryHandler } from './get-question-details.handler';
import { GetSectionManagementDetailsQueryHandler } from './get-section-details.handler';
import { GetExamCountsHandler } from './get-exam-counts.handler';

export const ExamManagementQueryHandlers = [
	FindExamsForManagementHandler,
	GetExamManagementDetailsQueryHandler,
	GetSectionManagementDetailsQueryHandler,
	GetQuestionManagementDetailsQueryHandler,
	GetExamCountsHandler,
];
