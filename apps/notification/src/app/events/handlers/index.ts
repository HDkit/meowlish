import { AchievementEarnedHandler } from './achievement-earned.handler';
import { FlashCardProposalCreatedHandler } from './flashcard-proposal-created.handler';
import { FlashCardProposalDecidedHandler } from './flashcard-proposal-decided.handler';
import { ReportCreatedHandler } from './report-created.handler';
import { ReportStatusChangedHandler } from './report-status-changed.handler';

export const IntegrationEventHandlers = [
	AchievementEarnedHandler,
	FlashCardProposalCreatedHandler,
	FlashCardProposalDecidedHandler,
	ReportCreatedHandler,
	ReportStatusChangedHandler,
];
