import { AchievementEarnedHandler } from './achievement-earned.handler';
import { BlogCommentCreatedHandler } from './blog-comment-created.handler';
import { FlashCardProposalCreatedHandler } from './flashcard-proposal-created.handler';
import { FlashCardProposalDecidedHandler } from './flashcard-proposal-decided.handler';
import { ForumReplyCreatedHandler } from './forum-reply-created.handler';
import { ReportCreatedHandler } from './report-created.handler';
import { ReportStatusChangedHandler } from './report-status-changed.handler';

export const IntegrationEventHandlers = [
	AchievementEarnedHandler,
	BlogCommentCreatedHandler,
	FlashCardProposalCreatedHandler,
	FlashCardProposalDecidedHandler,
	ForumReplyCreatedHandler,
	ReportCreatedHandler,
	ReportStatusChangedHandler,
];
