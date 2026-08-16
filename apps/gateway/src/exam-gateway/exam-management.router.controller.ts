import { HasPermissions } from '../auth/decorators/permissions.decorator';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { EXAM_CLIENT } from './constants/exam';
import { CreateExamDto } from './dtos/req/management/create-exam.req.dto';
import { CreateQuestionDto } from './dtos/req/management/create-question.req.dto';
import { CreateSectionDto } from './dtos/req/management/create-section.req.dto';
import { FindExamsForManagentDto } from './dtos/req/management/find-exams.req.dto';
import { MoveQuestionDto } from './dtos/req/management/move-question.req.dto';
import { MoveSectionDto } from './dtos/req/management/move-section.req.dto';
import { ReviewExamDto } from './dtos/req/management/review-exam.req.dto';
import { UpdateExamDto } from './dtos/req/management/update-exam.req.dto';
import { UpdateQuestionDto } from './dtos/req/management/update-question.req.dto';
import { UpdateSectionDto } from './dtos/req/management/update-section.req.dto';
import { CreatedExamDto } from './dtos/res/management/created-exam.res.dto';
import { CreatedQuestionDto } from './dtos/res/management/created-question.res.dto';
import { CreatedSectionDto } from './dtos/res/management/created-section.res.dto';
import { ExamDetailedManagementInfoDto } from './dtos/res/management/exam.res.dto';
import { ExamsManagementInfoDto } from './dtos/res/management/exams.res.dto';
import { QuestionManagementInfoDto } from './dtos/res/management/question.res.dto';
import { SectionManagementInfoDto } from './dtos/res/management/sections.res.dto';
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
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Permission, Role } from '@server/typing';
import { ApiEmptyResponseEntity, ApiResponseEntity } from '@server/utils';

@HasRoles(Role.Mod, Role.Admin)
@ApiBearerAuth()
@ApiTags('Exam Management')
@Controller('management')
export class ExamManagementGatewayController implements OnModuleInit {
	private examManagementService!: exam.ExamManagementServiceClient;

	constructor(@Inject(EXAM_CLIENT) private readonly examClient: ClientGrpc) {}

	onModuleInit() {
		this.examManagementService = this.examClient.getService<exam.ExamManagementServiceClient>(
			exam.EXAM_MANAGEMENT_SERVICE_NAME,
		);
	}

	@Post()
	@ApiOperation({ summary: 'Create an exam' })
	@ApiResponseEntity(CreatedExamDto)
	@SerializeOptions({ type: CreatedExamDto })
	createExam(@Req() req: AuthenticatedRequest, @Body() body: CreateExamDto) {
		const res = this.examManagementService.createExam({ ...body, createdBy: req.user.sub });
		return res;
	}

	@Post('sections/:id/sections')
	@ApiOperation({ summary: 'Create a nested section inside a section' })
	@ApiResponseEntity(CreatedSectionDto)
	@SerializeOptions({ type: CreatedSectionDto })
	createSectionInSection(@Param('id') id: string, @Body() body: CreateSectionDto) {
		const res = this.examManagementService.createSection({ ...body, sectionId: id });
		return res;
	}

	@Post('sections/:id/questions')
	@ApiOperation({ summary: 'Create a question inside a section' })
	@ApiResponseEntity(CreatedQuestionDto)
	@SerializeOptions({ type: CreatedQuestionDto })
	createQuestion(@Param('id') id: string, @Body() body: CreateQuestionDto) {
		const res = this.examManagementService.createQuestion({ ...body, sectionId: id });
		return res;
	}

	@Patch('sections/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Update a section' })
	updateSection(@Param('id') id: string, @Body() body: UpdateSectionDto) {
		const res = this.examManagementService.updateSection({ ...body, id: id });
		return res;
	}

	@Patch('questions/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Update a question' })
	updateQuestion(@Param('id') id: string, @Body() body: UpdateQuestionDto) {
		const res = this.examManagementService.updateQuestion({ ...body, id: id });
		return res;
	}

	@Delete('sections/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a section' })
	deleteSection(@Param('id') id: string) {
		const res = this.examManagementService.deleteSection({ id: id });
		return res;
	}

	@Delete('questions/:id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete a question' })
	deleteQuestion(@Param('id') id: string) {
		const res = this.examManagementService.deleteQuestion({ id: id });
		return res;
	}

	@Patch('sections/:id/move')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Move a section' })
	moveSection(@Param('id') id: string, @Body() body: MoveSectionDto) {
		const res = this.examManagementService.moveSection({ ...body, id: id });
		return res;
	}

	@Patch('questions/:id/move')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Move a question' })
	moveQuestion(@Param('id') id: string, @Body() body: MoveQuestionDto) {
		const res = this.examManagementService.moveQuestion({ ...body, id: id });
		return res;
	}

	@Get('exams')
	@ApiOperation({ summary: 'Find exams for management' })
	@ApiResponseEntity(ExamsManagementInfoDto)
	@SerializeOptions({ type: ExamsManagementInfoDto, strategy: 'exposeAll' })
	findExams(@Query() query: FindExamsForManagentDto) {
		const res = this.examManagementService.findExams(query);
		return res;
	}

	@Get('exams/:id')
	@ApiOperation({ summary: 'Get detailed exam management data' })
	@ApiResponseEntity(ExamDetailedManagementInfoDto)
	@SerializeOptions({ type: ExamDetailedManagementInfoDto, strategy: 'exposeAll' })
	getExamDetails(@Param('id') examId: string) {
		const res = this.examManagementService.getExamDetails({ examId: examId });
		return res;
	}

	@Get('sections/:id')
	@ApiOperation({ summary: 'Get detailed section management data' })
	@ApiResponseEntity(SectionManagementInfoDto)
	@SerializeOptions({ type: SectionManagementInfoDto, strategy: 'exposeAll' })
	getSectionDetails(@Param('id') sectionId: string) {
		const res = this.examManagementService.getSectionDetails({ sectionId: sectionId });
		return res;
	}

	@Get('questions/:id')
	@ApiOperation({ summary: 'Get detailed question management data' })
	@ApiResponseEntity(QuestionManagementInfoDto)
	@SerializeOptions({ type: QuestionManagementInfoDto, strategy: 'exposeAll' })
	getQuestionDetails(@Param('id') questionId: string) {
		const res = this.examManagementService.getQuestionDetails({ questionId: questionId });
		return res;
	}

	@Patch(':id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Update an exam' })
	updateExam(@Param('id') id: string, @Body() body: UpdateExamDto) {
		const res = this.examManagementService.updateExam({ ...body, id: id });
		return res;
	}

	@Delete(':id')
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Delete an exam' })
	deleteExam(@Param('id') id: string) {
		const res = this.examManagementService.deleteExam({ id: id });
		return res;
	}

	@Patch(':id/review')
	@HasPermissions(Permission.EXAM_APPROVE)
	@ApiEmptyResponseEntity()
	@ApiOperation({ summary: 'Review and approve or reject an exam' })
	reviewExam(@Param('id') id: string, @Body() body: ReviewExamDto) {
		const res = this.examManagementService.reviewExam({ ...body, id: id });
		return res;
	}

	@Post(':id/sections')
	@ApiOperation({ summary: 'Create a section inside an exam' })
	@ApiResponseEntity(CreatedSectionDto)
	@SerializeOptions({ type: CreatedSectionDto })
	createSectionInExam(@Param('id') id: string, @Body() body: CreateSectionDto) {
		const res = this.examManagementService.createSection({ ...body, examId: id });
		return res;
	}
}
