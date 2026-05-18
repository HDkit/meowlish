import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import {
	RabbitPayload,
	RabbitSubscribe,
	defaultNackErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';
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
	) {}

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
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: WritingScoredEvent) {
		try {
			if (payload.status === 'error' || payload.error_code || payload.error_message)
				throw new Error(payload.error_message ?? payload.error_code);
			await this.attemptRepository.saveComment(payload.response_id, JSON.stringify(payload.data));
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
