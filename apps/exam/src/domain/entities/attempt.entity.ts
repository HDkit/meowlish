import {
	QuestionType,
	questionTypesThatAllowOnlySingleAnswer,
} from '../../enums/question-type.enum';
import {
	AttemptResponseCreatedEvent,
	AttemptResponseUpdatedEvent,
	AttemptSubmittedEvent,
} from '../events/attempt.event';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IEntity } from '@server/utils';

export class AttemptResponse implements IEntity<AttemptResponse> {
	public static newId(): string {
		return crypto.randomUUID();
	}

	public readonly id: string;
	public questionId: string;
	public isFlagged: boolean;
	public answers: Set<string>;
	public note: string | null;

	public constructor(constructorOptions: {
		id?: string;
		questionId: string;
		isFlagged?: boolean;
		answers?: string[];
		note?: string | null;
	}) {
		this.id = constructorOptions.id ?? AttemptResponse.newId();
		this.questionId = constructorOptions.questionId;
		this.isFlagged = constructorOptions.isFlagged ?? false;
		this.answers = new Set(constructorOptions.answers);
		this.note = constructorOptions.note ?? null;
	}

	public setAnswer(answer: string): void {
		if (this.answers.has(answer)) throw new ConflictException('Duplicate answer option');
		this.answers.add(answer);
	}

	public deleteAnswer(answer: string): void {
		if (!this.answers.has(answer)) throw new NotFoundException('Answer not found');
		this.answers.delete(answer);
	}

	public clearAnswers(): void {
		this.answers.clear();
	}

	public toggleFlag(): boolean {
		this.isFlagged = !this.isFlagged;
		return this.isFlagged;
	}

	public setNote(note: string): void {
		this.note = note;
	}
}

export class Attempt extends AggregateRoot<Event<any>> implements IEntity<Attempt> {
	public static newId() {
		return crypto.randomUUID();
	}

	private static maximumNetworkDelayInSeconds = 30; //seconds

	public readonly id: string;
	/** Optimistic-lock version as loaded; the repository saves only if it is still current. */
	public readonly version: number;
	public attemptedBy: string;
	public examId: string;
	public startedAt: Date;
	public endedAt: Date | null;
	public durationLimit: number;
	public readonly questions: Map<string, QuestionType>;
	public responses: AttemptResponse[];
	public isStrict: boolean;

	public constructor(constructorOptions: {
		id?: string;
		version?: number;
		attemptedBy: string;
		examId: string;
		startedAt: Date;
		endedAt?: Date | null;
		durationLimit: number; // in seconds
		questions?: { id: string; type: QuestionType }[];
		responses?: AttemptResponse[];
		isStrict?: boolean;
	}) {
		super();
		this.id = constructorOptions.id ?? Attempt.newId();
		this.version = constructorOptions.version ?? 0;
		this.attemptedBy = constructorOptions.attemptedBy;
		this.examId = constructorOptions.examId;
		this.questions = new Map(constructorOptions.questions?.map(q => [q.id, q.type]));
		this.startedAt = constructorOptions.startedAt;
		this.endedAt = constructorOptions.endedAt ?? null;
		this.durationLimit = constructorOptions.durationLimit;
		this.responses = constructorOptions.responses ?? [];
		this.isStrict = constructorOptions.isStrict ?? false;
	}

	private isWithinAllowedTime(timeStamp: Date): boolean {
		return (
			timeStamp.getTime() <
			this.startedAt.getTime() + (this.durationLimit + Attempt.maximumNetworkDelayInSeconds) * 1000
		);
	}

	private assertModifiable(timeStamp: Date): void {
		if (this.endedAt) throw new ConflictException('Exam result has already been submitted');
		if (!this.isWithinAllowedTime(timeStamp))
			throw new ForbiddenException('Exam submission time has expired');
	}

	private assertQuestionIncluded(questionId: string): void {
		if (!this.questions.has(questionId))
			throw new ConflictException("Question isn't included in this attempt");
	}

	// check if the question exists in the section in the domain service layer
	public answer(questionId: string, answer: string): void {
		this.assertModifiable(new Date());
		this.assertQuestionIncluded(questionId);
		const existingResponse = this.responses.find(r => r.questionId === questionId);
		if (existingResponse) {
			this.answerBasedOnQuestionType(existingResponse, answer);
			this.apply(
				new AttemptResponseUpdatedEvent({
					attemptId: this.id,
					data: structuredClone(existingResponse),
				}),
			);
		} else {
			const newResponse = new AttemptResponse({ questionId: questionId, answers: [answer] });
			this.responses.push(newResponse);
			this.apply(
				new AttemptResponseCreatedEvent({ attemptId: this.id, data: structuredClone(newResponse) }),
			);
		}
	}

	private answerBasedOnQuestionType(attemptResponse: AttemptResponse, answer: string): void {
		const questionType = this.questions.get(attemptResponse.questionId);
		if (!questionType)
			throw new ConflictException('Attempting to answer question outside selected sections');
		if (questionTypesThatAllowOnlySingleAnswer.includes(questionType)) {
			attemptResponse.clearAnswers();
			attemptResponse.setAnswer(answer);
			return;
		}
		attemptResponse.setAnswer(answer);
	}

	public deleteAnswer(questionId: string, answer?: string): void {
		this.assertModifiable(new Date());
		const existingResponse = this.responses.find(r => r.questionId === questionId);
		if (!existingResponse) throw new NotFoundException('Answer not found');
		// if answer was passed in
		if (answer) existingResponse.deleteAnswer(answer);
		// else, clear every answers
		else existingResponse.clearAnswers();
		this.apply(
			new AttemptResponseUpdatedEvent({
				attemptId: this.id,
				data: structuredClone(existingResponse),
			}),
		);
	}

	public addNote(questionId: string, note: string): void {
		this.assertModifiable(new Date());
		this.assertQuestionIncluded(questionId);
		const existingResponse = this.responses.find(r => r.questionId === questionId);
		if (existingResponse) {
			existingResponse.setNote(note);
			this.apply(
				new AttemptResponseUpdatedEvent({
					attemptId: this.id,
					data: structuredClone(existingResponse),
				}),
			);
		} else {
			const newResponse = new AttemptResponse({ questionId: questionId, note: note });
			this.responses.push(newResponse);
			this.apply(
				new AttemptResponseCreatedEvent({ attemptId: this.id, data: structuredClone(newResponse) }),
			);
		}
	}

	public toggleFlag(questionId: string): boolean {
		this.assertModifiable(new Date());
		this.assertQuestionIncluded(questionId);
		const existingResponse = this.responses.find(r => r.questionId === questionId);
		if (existingResponse) {
			const flagState = existingResponse.toggleFlag();
			this.apply(
				new AttemptResponseUpdatedEvent({
					attemptId: this.id,
					data: structuredClone(existingResponse),
				}),
			);
			return flagState;
		} else {
			const defaultFlagState = true;
			const newResponse = new AttemptResponse({
				questionId: questionId,
				isFlagged: defaultFlagState,
			});
			this.responses.push(newResponse);
			this.apply(
				new AttemptResponseCreatedEvent({ attemptId: this.id, data: structuredClone(newResponse) }),
			);
			return defaultFlagState;
		}
	}

	/**
	 * Idempotent: ending an attempt that has already ended is a no-op (no event, nothing to save).
	 * @returns whether this call ended the attempt
	 */
	public endAttempt(): boolean {
		const timeStamp = new Date();
		if (this.endedAt) return false;
		if (!this.responses.length && this.questions.size) {
			if (this.isWithinAllowedTime(timeStamp))
				throw new ForbiddenException('Must at least answer one question before submitting');
		}
		this.endedAt = timeStamp;
		this.apply(new AttemptSubmittedEvent({ attemptId: this.id }));
		return true;
	}
}
