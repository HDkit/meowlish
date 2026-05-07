import { IsPublic } from '../auth/decorators/public.decorator';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { EXAM_CLIENT } from './constants/exam';
import { AddNoteDto } from './dtos/req/practice/add-note.req.dto';
import { AnswerDto } from './dtos/req/practice/answer.req.dto';
import { AttemptDto } from './dtos/req/practice/attempt.req.dto';
import { FindExamsDto } from './dtos/req/practice/find-exams.req.dto';
import { GetUserCalendarDto } from './dtos/req/practice/get-user-calendar.req.dto';
import { GetUsersAttemptHistoryDto } from './dtos/req/practice/get-users-attempt-history.req.dto';
import { RemoveAnswerDto } from './dtos/req/practice/remove-answer.req.dto';
import { AttemptDataDto } from './dtos/res/practice/attempt-data.res.dto';
import { AttemptReviewDto } from './dtos/res/practice/attempt-review.res.dto';
import { AttemptsHistoryDto } from './dtos/res/practice/attempts-history.res.dto';
import { CreatedAttemptDto } from './dtos/res/practice/created-attempt.res.dto';
import { ExamDetailDto } from './dtos/res/practice/exam-detail.res.dto';
import { ExamStatsDto } from './dtos/res/practice/exam-stats.res.dto';
import { ExamsInfoDto } from './dtos/res/practice/exams.res.dto';
import { FlagStateDto } from './dtos/res/practice/flag-state.res.dto';
import { QuestionDetailDto } from './dtos/res/practice/question-detail.res.dto';
import { UserCalendarDto } from './dtos/res/practice/user-calendar.res.dto';
import { UserStatsDto } from './dtos/res/practice/user-stats.res.dto';
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	OnModuleInit,
	Param,
	Patch,
	Post,
	Query,
	Req,
	SerializeOptions,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

@ApiBearerAuth()
@ApiTags('Exam Practice')
@Controller('practice')
export class ExamPracticeGatewayController implements OnModuleInit {
	private examPracticeService!: exam.ExamPracticeServiceClient;

	constructor(@Inject(EXAM_CLIENT) private readonly examClient: ClientGrpc) {}

	onModuleInit() {
		this.examPracticeService = this.examClient.getService<exam.ExamPracticeServiceClient>(
			exam.EXAM_PRACTICE_SERVICE_NAME,
		);
	}

	@Post('new/:id')
	@ApiOperation({ summary: 'Start a practice attempt for an exam' })
	@ApiResponseEntity(CreatedAttemptDto)
	@SerializeOptions({ type: CreatedAttemptDto })
	attempt(@Req() req: AuthenticatedRequest, @Param('id') examId: string, @Body() body: AttemptDto) {
		const res = this.examPracticeService.attempt({ ...body, examId: examId, userId: req.user.sub });
		return res;
	}

	@Post('attempt/:id/submit')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Submit an attempt' })
	endAttempt(@Param('id') id: string) {
		const res = this.examPracticeService.endAttempt({ attemptId: id });
		return res;
	}

	@Post('attempt/:id/answers/:questionId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Answer a question in an attempt' })
	answer(
		@Param('id') id: string,
		@Param('questionId') questionId: string,
		@Body() body: AnswerDto,
	) {
		const res = this.examPracticeService.answer({ ...body, attemptId: id, questionId: questionId });
		return res;
	}

	@Delete('attempt/:id/answers/:questionId')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Remove an answer from a question in an attempt' })
	removeAnswer(
		@Param('id') id: string,
		@Param('questionId') questionId: string,
		@Body() body: RemoveAnswerDto,
	) {
		const res = this.examPracticeService.removeAnswer({
			...body,
			attemptId: id,
			questionId: questionId,
		});
		return res;
	}

	@Patch('attempt/:id/answers/:questionId/flag')
	@ApiOperation({ summary: 'Toggle question flag state' })
	@ApiResponseEntity(FlagStateDto)
	@SerializeOptions({ type: FlagStateDto })
	toggleFlag(@Param('id') id: string, @Param('questionId') questionId: string) {
		const res = this.examPracticeService.toggleFlag({
			attemptId: id,
			questionId: questionId,
		});
		return res;
	}

	@Patch('attempt/:id/answers/:questionId/note')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Add or update a note for a question' })
	addNote(
		@Param('id') id: string,
		@Param('questionId') questionId: string,
		@Body() body: AddNoteDto,
	) {
		const res = this.examPracticeService.addNote({
			...body,
			attemptId: id,
			questionId: questionId,
		});
		return res;
	}

	@Get()
	@IsPublic()
	@ApiOperation({ summary: 'Find exams available for practice' })
	@ApiResponseEntity(ExamsInfoDto)
	@SerializeOptions({ type: ExamsInfoDto, strategy: 'exposeAll' })
	findExams(@Query() query: FindExamsDto) {
		const res = this.examPracticeService.findExams(query);
		return res;
	}

	@Get('info/:id/details')
	@IsPublic()
	@ApiOperation({ summary: 'Get exam details for practice' })
	@ApiResponseEntity(ExamDetailDto)
	@SerializeOptions({ type: ExamDetailDto, strategy: 'exposeAll' })
	getExamDetails(@Param('id') examId: string) {
		const res = this.examPracticeService.getExamDetails({ examId: examId });
		return res;
	}

	@Get('questions/:id/details')
	@IsPublic()
	@ApiOperation({ summary: 'Get detailed question information for practice' })
	@ApiResponseEntity(QuestionDetailDto)
	@SerializeOptions({ type: QuestionDetailDto, strategy: 'exposeAll' })
	getDetailedQuestionInfo(@Param('id') questionId: string) {
		const res = this.examPracticeService.getDetailedQuestionInfo({ questionId: questionId });
		return res;
	}

	@Get('info/:id/stats')
	@IsPublic()
	@ApiOperation({ summary: 'Get aggregate exam statistics' })
	@ApiResponseEntity(ExamStatsDto)
	@SerializeOptions({ type: ExamStatsDto, strategy: 'exposeAll' })
	getExamStats(@Param('id') examId: string) {
		const res = this.examPracticeService.getExamStats({ examId: examId });
		return res;
	}

	@Get('attempt/:id/saved')
	@ApiOperation({ summary: 'Get saved attempt data' })
	@ApiResponseEntity(AttemptDataDto)
	@SerializeOptions({ type: AttemptDataDto, strategy: 'exposeAll' })
	getAttemptSavedData(@Param('id') attemptId: string) {
		const res = this.examPracticeService.getAttemptSavedData({ attemptId: attemptId });
		return res;
	}

	@Get('attempt/:id/review')
	@ApiOperation({ summary: 'Get attempt review data' })
	@ApiResponseEntity(AttemptReviewDto)
	@SerializeOptions({ type: AttemptReviewDto, strategy: 'exposeAll' })
	getAttemptReview(@Param('id') attemptId: string) {
		const res = this.examPracticeService.getAttemptReview({ attemptId: attemptId });
		return res;
	}

	@Get('my/calendar')
	@ApiOperation({ summary: 'Get the authenticated user practice calendar' })
	@ApiResponseEntity(UserCalendarDto)
	@SerializeOptions({ type: UserCalendarDto, strategy: 'exposeAll' })
	getUsersAttemptSummary(@Req() request: AuthenticatedRequest, @Query() query: GetUserCalendarDto) {
		const res = this.examPracticeService.getUsersAttemptSummary({
			uid: request.user.sub,
			...query,
		});
		return res;
	}

	@Get('my/history')
	@ApiOperation({ summary: 'Get the authenticated user attempt history' })
	@ApiResponseEntity(AttemptsHistoryDto)
	@SerializeOptions({ type: AttemptsHistoryDto, strategy: 'exposeAll' })
	getUsersAttemptHistory(
		@Req() request: AuthenticatedRequest,
		@Query() query: GetUsersAttemptHistoryDto,
	) {
		const res = this.examPracticeService.getUsersAttemptHistory({
			uid: request.user.sub,
			...query,
		});
		return res;
	}

	@Get('my/stats')
	@ApiOperation({ summary: 'Get the authenticated user practice stats' })
	@ApiResponseEntity(UserStatsDto)
	@SerializeOptions({ type: UserStatsDto, strategy: 'exposeAll' })
	getUserStats(@Req() request: AuthenticatedRequest) {
		const res = this.examPracticeService.getUserStats({ uid: request.user.sub });
		return res;
	}
}
