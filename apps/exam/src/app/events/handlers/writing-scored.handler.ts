import {
	WRITING_SCORED_MAX_RETRIES,
	WRITING_SCORED_RETRY_QUEUE_NAME,
} from '../../../configs/rmq.sub.config';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { AmqpConnectionManager, RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, InternalServerErrorException, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter, RETRY_COUNT_HEADER, getRetryRoutingKey } from '@server/utils';
import type { ConsumeMessage } from 'amqplib';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

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
		private readonly amqpConnectionManager: AmqpConnectionManager,
	) {}

	private get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.writing.scored',
		queue: 'exam.events.writing.scored',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'exam.dlx',
			deadLetterRoutingKey: 'writing.result.dlq',
		},
	})
	async handle(@RabbitPayload() payload: WritingScoredEvent, amqpMsg?: ConsumeMessage) {
		const retryCount: number = (amqpMsg?.properties?.headers?.[RETRY_COUNT_HEADER] as number) ?? 0;

		try {
			if (payload.status === 'error' || payload.error_code || payload.error_message)
				throw new Error(payload.error_message ?? payload.error_code);
			await this.attemptRepository.saveComment(payload.response_id, JSON.stringify(payload.data));
		} catch (e) {
			if (retryCount < WRITING_SCORED_MAX_RETRIES) {
				const routingKey = getRetryRoutingKey(WRITING_SCORED_RETRY_QUEUE_NAME, retryCount);
				this.logger.warn(
					`Writing scored failed, retry ${retryCount + 1}/${WRITING_SCORED_MAX_RETRIES} via ${routingKey}`,
				);
				await this.amqpConnection.publish('exam.retry', routingKey, payload, {
					persistent: true,
					headers: { [RETRY_COUNT_HEADER]: retryCount + 1 },
				});
				return;
			}

			this.logger.error(
				`Writing scored max retries (${WRITING_SCORED_MAX_RETRIES}) exceeded for response ${payload.response_id}: ${e as string}`,
			);
			throw e;
		}
	}
}
