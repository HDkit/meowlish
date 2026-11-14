import { AttemptRescoredHandler } from './attempt-rescored.handler';
import { AttemptScoredHandler } from './attempt-scored.handler';
import { AttemptSubmittedHandler } from './attempt-submitted.handler';
import { LoginHandler } from './login.handler';

export const IntegrationEventHandlers = [
	AttemptRescoredHandler,
	AttemptScoredHandler,
	AttemptSubmittedHandler,
	LoginHandler,
];
