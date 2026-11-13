import { AchievementEarnedHandler } from './achievement-earned.handler';
import { ReportCreatedHandler } from './report-created.handler';
import { ReportStatusChangedHandler } from './report-status-changed.handler';

export const IntegrationEventHandlers = [
	AchievementEarnedHandler,
	ReportCreatedHandler,
	ReportStatusChangedHandler,
];
