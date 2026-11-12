import { AttemptConfig } from '../entities/attempt-config.entity';
import { AttemptEvaluator } from '../entities/attempt-evaluator.entity';
import { Attempt } from '../entities/attempt.entity';
import { ConflictException } from '@nestjs/common';

export interface IAttemptRepository {
	findOne(id: string): Promise<Attempt | null>;
	getAttemptedUser(attemptId: string): Promise<string | null>;
	getScoreEvaluator(attemptId: string): Promise<AttemptEvaluator | null>;
	save(attempt: Attempt | AttemptConfig | AttemptEvaluator): Promise<void>;
	deleteMany(ids: string[]): Promise<void>;
	// for AI
	getWritingResponse(
		responseOrAttemptId: string,
		questionId?: string,
	): Promise<{
		attemptedBy: string;
		examId: string;
		examTags: string[];
		questionContent: string;
		questionTags: string[];
		answer?: string[];
	} | null>;
	/** Upserts the AI feedback of a response and returns the id of the attempt it belongs to. */
	saveComment(responseId: string, comment: unknown): Promise<string>;
}

export const IAttemptRepositoryToken = Symbol('IAttemptRepository');

/**
 * `save` found the attempt at a different `version` than the one it loaded: someone else saved
 * it in between. Reload and retry, or surface it as a 409.
 */
export class AttemptVersionConflictException extends ConflictException {
	constructor() {
		super('The attempt was modified concurrently, please retry');
	}
}

export const isAttemptVersionConflict = (error: unknown): boolean =>
	error instanceof AttemptVersionConflictException;
