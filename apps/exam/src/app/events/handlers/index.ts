import { AttemptSubmittedHandler } from './attempt-submitted.handler';
import { WritingScoredHandler } from './writing-scored.handler';

export const ExamEventHandlers = [AttemptSubmittedHandler];

export const IntegrationEventHandlers = [WritingScoredHandler];
