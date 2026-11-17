import { QuestionType, questionTypesThatAllowNonStrictMatch } from '../../enums/question-type.enum';
import { AttemptScoredEvent } from '../events/attempt.event';
import { WritingSubmittedEvent } from '../events/writing-submitted';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate, IEntity } from '@server/utils';
import { isEqual } from 'lodash';

export class AttemptResponseResult implements IEntity<AttemptResponseResult> {
	public isCorrect: boolean;

	public constructor(
		public readonly id: string,
		public readonly questionId: string,
		public readonly answers: string[],
		isCorrect?: boolean | null,
		/** Band (0–9) the AI scorer gave a writing answer; null until its feedback arrives. */
		public readonly writingBand: number | null = null,
	) {
		this.answers = answers.map(a => a.toLowerCase()).sort();
		this.isCorrect = !!isCorrect;
	}

	public setIsCorrect(isCorrect: boolean): void {
		this.isCorrect = isCorrect;
	}
}

export class AttemptQuestion implements IEntity<AttemptQuestion> {
	public constructor(
		public readonly id: string,
		public readonly type: QuestionType,
		public readonly correctKeys: string[],
		public readonly points: number,
	) {
		this.correctKeys = correctKeys.map(a => a.toLowerCase()).sort();
	}
}

export class AttemptEvaluator
	extends AggregateRoot<Event<any>>
	implements IAggregate<AttemptEvaluator>
{
	/** Highest band the AI writing scorer gives (IELTS scale). */
	public static readonly maxWritingBand = 9;

	public readonly id: string;
	/** Optimistic-lock version of the attempt row as loaded. */
	public readonly version: number;
	public readonly questions: AttemptQuestion[];
	public readonly responses: Map<string, AttemptResponseResult>;
	public score: number;
	public totalPoints: number;

	public constructor(constructorOptions: {
		id: string;
		version?: number;
		questions: AttemptQuestion[];
		responses: AttemptResponseResult[];
		score?: number;
		totalPoints?: number;
	}) {
		super();
		this.id = constructorOptions.id;
		this.version = constructorOptions.version ?? 0;
		this.questions = constructorOptions.questions;
		this.responses = new Map(constructorOptions.responses.map(r => [r.questionId, r]));
		this.score = constructorOptions.score ?? 0;
		this.totalPoints = constructorOptions.totalPoints ?? 0;
	}

	/**
	 * First scoring, right after submit: scores the objective answers, asks the AI scorer to grade
	 * each writing answer (writing.submitted) and announces the score (attempt.scored).
	 */
	public evaluateScore(): void {
		this.computeScore(true);
		this.apply(
			new AttemptScoredEvent({
				attemptId: this.id,
				score: this.score,
				totalPoints: this.totalPoints,
			}),
		);
	}

	/**
	 * Re-scores after AI feedback for a writing answer was saved, so its points count. Raises no
	 * events: the writing answers are already being graded, and re-announcing attempt.scored would
	 * count the attempt twice towards achievements.
	 */
	public recomputeScore(): void {
		this.computeScore(false);
	}

	private computeScore(requestWritingScoring: boolean): void {
		this.score = 0;
		this.totalPoints = 0;
		this.questions.forEach(question => {
			this.totalPoints += question.points;
			const response = this.responses.get(question.id);
			if (response) {
				this.score += this.scoreFor(question, response, requestWritingScoring);
			}
		});
	}

	private scoreFor(
		question: AttemptQuestion,
		response: AttemptResponseResult,
		requestWritingScoring: boolean,
	): number {
		if (question.type === QuestionType.Writing) {
			if (response.writingBand !== null) return this.writingPoints(question, response.writingBand);
			if (!requestWritingScoring) return 0;
			this.apply(
				new WritingSubmittedEvent({
					attemptId: this.id,
					responseId: response.id,
					questionId: question.id,
					responseContent: response.answers[0] ?? '',
				}),
			);
			return 0;
		}
		// If question types only need user to match one of the many correct keys
		if (questionTypesThatAllowNonStrictMatch.includes(question.type)) {
			if (question.correctKeys.some(k => response.answers.includes(k))) {
				response.setIsCorrect(true);
				return question.points;
			}
		}
		// Else must match all keys
		else if (isEqual(response.answers, question.correctKeys)) {
			response.setIsCorrect(true);
			return question.points;
		}
		response.setIsCorrect(false);
		return 0;
	}

	/** Scales the AI band (0–9) to the question's points; the score column is an integer. */
	private writingPoints(question: AttemptQuestion, band: number): number {
		const ratio = Math.min(Math.max(band / AttemptEvaluator.maxWritingBand, 0), 1);
		return Math.round(question.points * ratio);
	}
}
