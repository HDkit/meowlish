import { WRITING_SCORED_QUEUE } from '../../../configs/rmq.sub.config';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../services/attempt-conflict-retry';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, NotFoundException, UseFilters } from '@nestjs/common';
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
		if (payload.status === 'error' || payload.error_code || payload.error_message)
			throw new Error(payload.error_message ?? payload.error_code ?? 'Writing scoring failed');
		// Two writings of one attempt scored at once: the later save conflicts on the attempt
		// version and re-runs, now seeing both feedbacks. Redelivery just re-saves the same feedback.
		await retryAttemptConflicts(() => this.saveFeedbackAndRescore(payload));
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
