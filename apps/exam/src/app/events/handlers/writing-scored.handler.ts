import { WRITING_SCORED_QUEUE } from '../../../configs/rmq.sub.config';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../services/attempt-conflict-retry';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, NotFoundException, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export class WritingSubScoresDto {
	@IsNumber()
	'Task Exam': number;

	@IsNumber()
	'Coherence & Cohesion': number;

	@IsNumber()
	'Lexical Resource': number;

	@IsNumber()
	'Grammatical Range & Accuracy': number;
}

export class CorrectionDto {
	@IsObject()
	data!: Record<string, any>;
}

export class WritingScoreDataDto {
	@IsNumber()
	overall_score!: number;

	@IsObject()
	sub_scores!: Record<string, number>;

	@IsString()
	detailed_feedback!: string;

	@IsString()
	corrected_version!: string;

	@Type(() => CorrectionDto)
	@IsArray()
	@IsOptional()
	@ValidateNested({ each: true })
	corrections?: CorrectionDto[];
}

export class WritingScoredEvent {
	@IsString()
	status!: string;

	@IsString()
	attempt_id!: string;

	@IsString()
	response_id!: string;

	@Type(() => WritingScoreDataDto)
	@IsOptional()
	@ValidateNested()
	data?: WritingScoreDataDto;

	@IsOptional()
	@IsString()
	error_code?: string;

	@IsOptional()
	@IsString()
	error_message?: string;
}

@Injectable()
export class WritingScoredHandler {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.writing.scored',
		// A throw is retried with backoff through exam.events.writing.scored.retry.N, then
		// dead-lettered to exam.events.writing.scored.dlq.
		...WRITING_SCORED_QUEUE.subscribe,
	})
	async handle(@RabbitPayload() payload: WritingScoredEvent): Promise<void> {
		const failed = payload.status === 'error' || !!payload.error_code || !!payload.error_message;
		if (failed || !payload.data) {
			// The scorer has already retried on its side: retrying here cannot change the outcome, and
			// throwing only dead-lettered the message and left the student waiting. Record the failure
			// so the review shows it; a later successful result for the response replaces it.
			await this.saveFailure(payload, failed ? undefined : 'INVALID_RESULT');
			return;
		}
		// Two writings of one attempt scored at once: the later save conflicts on the attempt
		// version and re-runs, now seeing both feedbacks. Redelivery just re-saves the same feedback.
		await retryAttemptConflicts(() => this.saveFeedbackAndRescore(payload));
	}

	@Transactional()
	private async saveFailure(payload: WritingScoredEvent, errorCode?: string): Promise<void> {
		const failure = {
			status: 'error',
			error_code: errorCode ?? payload.error_code ?? 'SCORING_FAILED',
			error_message:
				errorCode ? 'The scorer sent a result without feedback' : (payload.error_message ?? null),
			failed_at: new Date().toISOString(),
		};
		// stored like the feedback itself: a JSON string, read back through the review's additionalData
		const stored = await this.attemptRepository.saveScoringFailure(
			payload.response_id,
			JSON.stringify(failure),
		);
		if (!stored)
			this.logger.warn(
				`Scoring failure for response ${payload.response_id} ignored: it already has a band`,
			);
	}

	/** Saves the AI feedback and the attempt score that now includes its points, atomically. */
	@Transactional()
	private async saveFeedbackAndRescore(payload: WritingScoredEvent): Promise<void> {
		const attemptId = await this.attemptRepository.saveComment(
			payload.response_id,
			JSON.stringify(payload.data),
		);
		const evaluator = await this.attemptRepository.getScoreEvaluator(attemptId);
		if (!evaluator) throw new NotFoundException('Attempt not found');
		evaluator.recomputeScore();
		await this.attemptRepository.save(evaluator);
	}
}
