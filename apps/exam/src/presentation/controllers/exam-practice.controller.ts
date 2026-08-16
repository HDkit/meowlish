import {
	AddNoteCommand,
	AddNoteCommandPayload,
} from '../../app/commands/practice/exam.add-note.command';
import {
	AnswerCommand,
	AnswerCommandPayload,
} from '../../app/commands/practice/exam.answer.command';
import {
	AttemptCommand,
	AttemptCommandPayload,
} from '../../app/commands/practice/exam.attempt.command';
import {
	EndAttemptCommand,
	EndAttemptCommandPayload,
} from '../../app/commands/practice/exam.end-attempt.command';
import {
	RemoveAnswerCommand,
	RemoveAnswerCommandPayload,
} from '../../app/commands/practice/exam.remove-answer.command';
import {
	ToggleFlagCommand,
	ToggleFlagCommandPayload,
} from '../../app/commands/practice/exam.toggle-flag.command';
import { FindExamsQuery } from '../../app/queries/practice/exam.find-exams.query';
import { GetAttemptDataQuery } from '../../app/queries/practice/exam.get-attempt-data.query';
import { GetAttemptReviewQuery } from '../../app/queries/practice/exam.get-attempt-review.query';
import { GetExamDetailsQuery } from '../../app/queries/practice/exam.get-exam-details.query';
import { GetExamStatsQuery } from '../../app/queries/practice/exam.get-exam-stats.query';
import { GetQuestionDetailsQuery } from '../../app/queries/practice/exam.get-question-details.query';
import { GetUserCalendarQuery } from '../../app/queries/practice/exam.get-user-calendar.query';
import { GetUserStatsQuery } from '../../app/queries/practice/exam.get-user-stats.query';
import { GetUsersAttemptHistoryQuery } from '../../app/queries/practice/exam.get-users-attempt-history.query';
import {
	type IPracticeReadRepository,
	IPracticeReadRepositoryToken,
} from '../../domain/repositories/practice.read.repository';
import { AddNoteDto } from '../dtos/req/practice/add-note.req.dto';
import { AnswerDto } from '../dtos/req/practice/answer.req.dto';
import { AttemptDto } from '../dtos/req/practice/attempt.req.dto';
import { EndAttemptDto } from '../dtos/req/practice/end-attempt.req.dto';
import { FindExamsDto } from '../dtos/req/practice/find-exams.req.dto';
import { GetAttemptDataDto } from '../dtos/req/practice/get-attempt-data.req.dto';
import { GetAttemptReviewDto } from '../dtos/req/practice/get-attempt-review.req.dto';
import { GetExamDetailsDto } from '../dtos/req/practice/get-exam-details.req.dto';
import { GetExamStatsDto } from '../dtos/req/practice/get-exam-stats.req.dto';
import { GetQuestionDetailsDto } from '../dtos/req/practice/get-question-details.req.dto';
import { GetUserCalendarDto } from '../dtos/req/practice/get-user-calendar.req.dto';
import { GetUsersAttemptHistoryDto } from '../dtos/req/practice/get-users-attempt-history.req.dto';
import { GetUsersStatsDto } from '../dtos/req/practice/get-users-stats.req.dto';
import { RemoveAnswerDto } from '../dtos/req/practice/remove-answer.req.dto';
import { ToggleFlagDto } from '../dtos/req/practice/toggle-flag.req.dto';
import { AttemptDataDto } from '../dtos/res/practice/attempt-data.res.dto';
import { AttemptReviewDto } from '../dtos/res/practice/attempt-review.res.dto';
import { AttemptsHistoryDto } from '../dtos/res/practice/attempts-history.res.dto';
import { CreatedAttemptDto } from '../dtos/res/practice/created-attempt.res.dto';
import { ExamDetailDto } from '../dtos/res/practice/exam-detail.res.dto';
import { ExamStatsDto } from '../dtos/res/practice/exam-stats.res.dto';
import { ExamsInfoDto } from '../dtos/res/practice/exams.res.dto';
import { FlagStateDto } from '../dtos/res/practice/flag-state.res.dto';
import { QuestionDetailDto } from '../dtos/res/practice/question-detail.res.dto';
import { UserCalendarDto } from '../dtos/res/practice/user-calendar.res.dto';
import { UserStatsDto } from '../dtos/res/practice/user-stats.res.dto';
import { Controller, Inject, SerializeOptions } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Payload } from '@nestjs/microservices';
import { exam } from '@server/generated';

@exam.ExamPracticeServiceControllerMethods()
@Controller()
export class ExamPracticeController implements exam.ExamPracticeServiceController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		@Inject(IPracticeReadRepositoryToken)
		private readonly praciceReadRepository: IPracticeReadRepository,
	) {}

	@SerializeOptions({ type: CreatedAttemptDto })
	async attempt(@Payload() request: AttemptDto): Promise<CreatedAttemptDto> {
		return await this.commandBus.execute(
			new AttemptCommand(
				new AttemptCommandPayload(request.userId, request.examId, request.options),
			),
		);
	}

	async endAttempt(@Payload() request: EndAttemptDto): Promise<void> {
		await this.commandBus.execute(
			new EndAttemptCommand(new EndAttemptCommandPayload(request.attemptId)),
		);
	}

	async answer(@Payload() request: AnswerDto): Promise<void> {
		await this.commandBus.execute(
			new AnswerCommand(
				new AnswerCommandPayload(request.attemptId, request.questionId, request.answer),
			),
		);
	}

	async removeAnswer(@Payload() request: RemoveAnswerDto): Promise<void> {
		await this.commandBus.execute(
			new RemoveAnswerCommand(
				new RemoveAnswerCommandPayload(request.attemptId, request.questionId, request.answer),
			),
		);
	}

	@SerializeOptions({ type: FlagStateDto })
	async toggleFlag(@Payload() request: ToggleFlagDto): Promise<FlagStateDto> {
		return await this.commandBus.execute(
			new ToggleFlagCommand(new ToggleFlagCommandPayload(request.attemptId, request.questionId)),
		);
	}

	async addNote(@Payload() request: AddNoteDto): Promise<void> {
		await this.commandBus.execute(
			new AddNoteCommand(
				new AddNoteCommandPayload(request.attemptId, request.questionId, request.note),
			),
		);
	}

	@SerializeOptions({ type: ExamsInfoDto, strategy: 'exposeAll' })
	async findExams(@Payload() request: FindExamsDto): Promise<ExamsInfoDto> {
		return await this.queryBus.execute(new FindExamsQuery(request));
	}

	@SerializeOptions({ type: ExamDetailDto, strategy: 'exposeAll' })
	async getExamDetails(@Payload() request: GetExamDetailsDto): Promise<ExamDetailDto> {
		return await this.queryBus.execute(new GetExamDetailsQuery(request));
	}

	@SerializeOptions({ type: QuestionDetailDto, strategy: 'exposeAll' })
	async getDetailedQuestionInfo(
		@Payload() request: GetQuestionDetailsDto,
	): Promise<QuestionDetailDto> {
		return await this.queryBus.execute(new GetQuestionDetailsQuery(request));
	}

	@SerializeOptions({ type: ExamStatsDto, strategy: 'exposeAll' })
	async getExamStats(@Payload() request: GetExamStatsDto): Promise<ExamStatsDto> {
		return await this.queryBus.execute(new GetExamStatsQuery(request));
	}

	@SerializeOptions({ type: AttemptDataDto, strategy: 'exposeAll' })
	async getAttemptSavedData(@Payload() request: GetAttemptDataDto): Promise<AttemptDataDto> {
		return await this.queryBus.execute(new GetAttemptDataQuery(request));
	}

	@SerializeOptions({ type: AttemptReviewDto, strategy: 'exposeAll' })
	async getAttemptReview(@Payload() request: GetAttemptReviewDto): Promise<AttemptReviewDto> {
		return await this.queryBus.execute(new GetAttemptReviewQuery(request));
	}

	@SerializeOptions({ type: UserCalendarDto, strategy: 'exposeAll' })
	async getUsersAttemptSummary(@Payload() request: GetUserCalendarDto): Promise<UserCalendarDto> {
		return await this.queryBus.execute(
			new GetUserCalendarQuery({ userId: request.uid, ...request }),
		);
	}

	@SerializeOptions({ type: AttemptsHistoryDto, strategy: 'exposeAll' })
	async getUsersAttemptHistory(
		@Payload() request: GetUsersAttemptHistoryDto,
	): Promise<AttemptsHistoryDto> {
		return await this.queryBus.execute(new GetUsersAttemptHistoryQuery(request));
	}

	@SerializeOptions({ type: UserStatsDto, strategy: 'exposeAll' })
	async getUsesStats(@Payload() request: GetUsersStatsDto): Promise<UserStatsDto> {
		return await this.queryBus.execute(new GetUserStatsQuery({ userId: request.uid, ...request }));
	}
}
