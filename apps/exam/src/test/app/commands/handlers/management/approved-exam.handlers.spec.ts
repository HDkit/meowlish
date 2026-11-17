import { CreateQuestionHandler } from '../../../../../app/commands/handlers/management/create-question.handler';
import { CreateSectionHandler } from '../../../../../app/commands/handlers/management/create-section.handler';
import { DeleteExamHandler } from '../../../../../app/commands/handlers/management/delete-exam.handler';
import { DeleteQuestionHandler } from '../../../../../app/commands/handlers/management/delete-question.handler';
import { DeleteSectionHandler } from '../../../../../app/commands/handlers/management/delete-section.handler';
import { MoveQuestionHandler } from '../../../../../app/commands/handlers/management/move-question.handler';
import { MoveSectionHandler } from '../../../../../app/commands/handlers/management/move-section.handler';
import { ReviewExamHandler } from '../../../../../app/commands/handlers/management/review-exam.handler';
import { UpdateExamHandler } from '../../../../../app/commands/handlers/management/update-exam.handler';
import { UpdateQuestionHandler } from '../../../../../app/commands/handlers/management/update-question.handler';
import { UpdateSectionHandler } from '../../../../../app/commands/handlers/management/update-section.handler';
import {
	CreateQuestionCommand,
	CreateQuestionCommandPayload,
} from '../../../../../app/commands/staff/exam.create-question.command';
import {
	CreateSectionCommand,
	CreateSectionCommandPayload,
} from '../../../../../app/commands/staff/exam.create-section.command';
import {
	DeleteExamCommand,
	DeleteExamCommandPayload,
} from '../../../../../app/commands/staff/exam.delete-exam.command';
import {
	DeleteQuestionCommand,
	DeleteQuestionCommandPayload,
} from '../../../../../app/commands/staff/exam.delete-question.command';
import {
	DeleteSectionCommand,
	DeleteSectionCommandPayload,
} from '../../../../../app/commands/staff/exam.delete-section.command';
import {
	MoveQuestionCommand,
	MoveQuestionCommandPayload,
} from '../../../../../app/commands/staff/exam.move-question.command';
import {
	MoveSectionCommand,
	MoveSectionCommandPayload,
} from '../../../../../app/commands/staff/exam.move-section.command';
import {
	ReviewExamCommand,
	ReviewExamCommandPayload,
} from '../../../../../app/commands/staff/exam.review-exam.command';
import {
	UpdateExamCommand,
	UpdateExamCommandPayload,
} from '../../../../../app/commands/staff/exam.update-exam.command';
import {
	UpdateQuestionCommand,
	UpdateQuestionCommandPayload,
} from '../../../../../app/commands/staff/exam.update-question.command';
import {
	UpdateSectionCommand,
	UpdateSectionCommandPayload,
} from '../../../../../app/commands/staff/exam.update-section.command';
import { Exam, ExamId, ExamSection } from '../../../../../domain/entities/exam.entity';
import { Choice, Question } from '../../../../../domain/entities/question.entity';
import { Section, SectionChild } from '../../../../../domain/entities/section.entity';
import { ExamStatus } from '../../../../../enums/exam-status.enum';
import { QuestionType } from '../../../../../enums/question-type.enum';
import { SectionType } from '../../../../../enums/section-type.enum';
import { ConflictException } from '@nestjs/common';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

// C28: once approved, an exam can only be deleted. Every other management mutation is a 409.

const examId = new ExamId('e1', 1);

/** An approved exam with two root sections: s1 holds child sections, s2 holds questions. */
const approvedExam = () =>
	new Exam({
		id: examId,
		title: 'Approved',
		duration: 600,
		createdBy: 'mod',
		status: ExamStatus.Approved,
		description: null,
		sections: [new ExamSection('s1', 0), new ExamSection('s2', 1000)],
		tags: ['t1'],
	});

const sectionOfSections = () =>
	new Section({
		id: 's1',
		examId: examId,
		examStatus: ExamStatus.Approved,
		children: [new SectionChild('s11', 0), new SectionChild('s12', 1000)],
		contentType: SectionType.Section,
		directive: '',
		tags: ['t1'],
		fileIds: ['f1'],
	});

const sectionOfQuestions = () =>
	new Section({
		id: 's2',
		examId: examId,
		examStatus: ExamStatus.Approved,
		children: [new SectionChild('q1', 0), new SectionChild('q2', 1000)],
		contentType: SectionType.Question,
		directive: '',
		tags: ['t1'],
		fileIds: ['f1'],
	});

const approvedQuestion = () =>
	new Question({
		id: 'q1',
		examId: examId,
		examStatus: ExamStatus.Approved,
		sectionId: 's2',
		content: '',
		type: QuestionType.MultipleChoiceSingle,
		points: 1,
		explanation: '',
		choices: [
			new Choice({ id: 'A', key: 'a', isCorrect: true }),
			new Choice({ id: 'B', key: 'b', isCorrect: false }),
		],
		tags: ['t1'],
		fileIds: ['f1'],
	});

const repos = () => {
	const exams = {
		findOne: jest.fn().mockImplementation(() => Promise.resolve(approvedExam())),
		getParentExamOfSection: jest.fn().mockImplementation(() => Promise.resolve(approvedExam())),
		save: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
	};
	const sections = {
		findOne: jest
			.fn()
			.mockImplementation((id: string) =>
				Promise.resolve(id === 's1' ? sectionOfSections() : sectionOfQuestions()),
			),
		getParentSectionOfSection: jest
			.fn()
			.mockImplementation(() => Promise.resolve(sectionOfSections())),
		getParentSectionOfQuestion: jest
			.fn()
			.mockImplementation(() => Promise.resolve(sectionOfQuestions())),
		findOneInTheSameExamAsSection: jest
			.fn()
			.mockImplementation(() => Promise.resolve(sectionOfSections())),
		findOneInTheSameExamAsQuestion: jest
			.fn()
			.mockImplementation(() => Promise.resolve(sectionOfQuestions())),
		isInSubtreeOf: jest.fn().mockResolvedValue(false),
		save: jest.fn().mockResolvedValue(undefined),
	};
	const questions = {
		findOne: jest.fn().mockImplementation(() => Promise.resolve(approvedQuestion())),
		save: jest.fn().mockResolvedValue(undefined),
	};
	const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
	const outbox = { add: jest.fn().mockResolvedValue(undefined) };
	return {
		exams: exams,
		sections: sections,
		questions: questions,
		publisher: publisher,
		outbox: outbox,
	};
};

type Repos = ReturnType<typeof repos>;

const expectNothingSaved = (r: Repos) => {
	expect(r.exams.save).not.toHaveBeenCalled();
	expect(r.exams.delete).not.toHaveBeenCalled();
	expect(r.sections.save).not.toHaveBeenCalled();
	expect(r.questions.save).not.toHaveBeenCalled();
	expect(r.publisher.publish).not.toHaveBeenCalled();
	expect(r.outbox.add).not.toHaveBeenCalled();
};

const cases: [string, (r: Repos) => Promise<unknown>][] = [
	...[ExamStatus.Rejected, ExamStatus.Pending, ExamStatus.Approved].map(
		(status): [string, (r: Repos) => Promise<unknown>] => [
			`review: set status ${status}`,
			r =>
				new ReviewExamHandler(r.exams).execute(
					new ReviewExamCommand(new ReviewExamCommandPayload('e1', status)),
				),
		],
	),
	[
		'update exam details',
		r =>
			new UpdateExamHandler(r.exams).execute(
				new UpdateExamCommand(new UpdateExamCommandPayload({ id: 'e1', title: 'new' })),
			),
	],
	[
		'add an exam tag',
		r =>
			new UpdateExamHandler(r.exams).execute(
				new UpdateExamCommand(new UpdateExamCommandPayload({ id: 'e1', addTags: ['t2'] })),
			),
	],
	[
		'remove an exam tag',
		r =>
			new UpdateExamHandler(r.exams).execute(
				new UpdateExamCommand(new UpdateExamCommandPayload({ id: 'e1', removeTags: ['t1'] })),
			),
	],
	[
		'create a root section',
		r =>
			new CreateSectionHandler(r.exams, r.sections).execute(
				new CreateSectionCommand(new CreateSectionCommandPayload({ examId: 'e1' })),
			),
	],
	[
		'create a nested section',
		r =>
			new CreateSectionHandler(r.exams, r.sections).execute(
				new CreateSectionCommand(new CreateSectionCommandPayload({ sectionId: 's1' })),
			),
	],
	[
		'create a question',
		r =>
			new CreateQuestionHandler(r.sections).execute(
				new CreateQuestionCommand(new CreateQuestionCommandPayload('s2')),
			),
	],
	[
		'update section details',
		r =>
			new UpdateSectionHandler(r.sections, r.publisher as never).execute(
				new UpdateSectionCommand(new UpdateSectionCommandPayload({ id: 's2', directive: 'new' })),
			),
	],
	[
		'add a section tag',
		r =>
			new UpdateSectionHandler(r.sections, r.publisher as never).execute(
				new UpdateSectionCommand(new UpdateSectionCommandPayload({ id: 's2', addTags: ['t2'] })),
			),
	],
	[
		'remove a section tag',
		r =>
			new UpdateSectionHandler(r.sections, r.publisher as never).execute(
				new UpdateSectionCommand(new UpdateSectionCommandPayload({ id: 's2', removeTags: ['t1'] })),
			),
	],
	[
		'add a section file',
		r =>
			new UpdateSectionHandler(r.sections, r.publisher as never).execute(
				new UpdateSectionCommand(new UpdateSectionCommandPayload({ id: 's2', addFiles: ['f2'] })),
			),
	],
	[
		'remove a section file',
		r =>
			new UpdateSectionHandler(r.sections, r.publisher as never).execute(
				new UpdateSectionCommand(
					new UpdateSectionCommandPayload({ id: 's2', removeFiles: ['f1'] }),
				),
			),
	],
	[
		'update question details',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(new UpdateQuestionCommandPayload({ id: 'q1', points: 2 })),
			),
	],
	[
		'add a choice',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(
					new UpdateQuestionCommandPayload({
						id: 'q1',
						addChoices: [{ key: 'c', isCorrect: false }],
					}),
				),
			),
	],
	[
		'update a choice',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(
					new UpdateQuestionCommandPayload({ id: 'q1', updateChoices: [{ id: 'B', key: 'x' }] }),
				),
			),
	],
	[
		'delete a choice',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(
					new UpdateQuestionCommandPayload({ id: 'q1', deleteChoicesIds: ['B'] }),
				),
			),
	],
	[
		'add a question tag',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(new UpdateQuestionCommandPayload({ id: 'q1', addTags: ['t2'] })),
			),
	],
	[
		'remove a question tag',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(
					new UpdateQuestionCommandPayload({ id: 'q1', removeTags: ['t1'] }),
				),
			),
	],
	[
		'add a question file',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(new UpdateQuestionCommandPayload({ id: 'q1', addFiles: ['f2'] })),
			),
	],
	[
		'remove a question file',
		r =>
			new UpdateQuestionHandler(r.questions, r.publisher as never).execute(
				new UpdateQuestionCommand(
					new UpdateQuestionCommandPayload({ id: 'q1', removeFiles: ['f1'] }),
				),
			),
	],
	[
		'delete a nested section',
		r =>
			new DeleteSectionHandler(r.exams, r.sections).execute(
				new DeleteSectionCommand(new DeleteSectionCommandPayload('s11')),
			),
	],
	[
		'delete a root section',
		r => {
			r.sections.getParentSectionOfSection.mockResolvedValue(null);
			return new DeleteSectionHandler(r.exams, r.sections).execute(
				new DeleteSectionCommand(new DeleteSectionCommandPayload('s1')),
			);
		},
	],
	[
		'delete a question',
		r =>
			new DeleteQuestionHandler(r.sections).execute(
				new DeleteQuestionCommand(new DeleteQuestionCommandPayload('q1')),
			),
	],
	[
		'move a section under another section',
		r =>
			new MoveSectionHandler(r.exams, r.sections).execute(
				new MoveSectionCommand(new MoveSectionCommandPayload({ id: 's2', parentId: 's1' })),
			),
	],
	[
		'move a section to the exam root',
		r =>
			new MoveSectionHandler(r.exams, r.sections).execute(
				new MoveSectionCommand(new MoveSectionCommandPayload({ id: 's11', toRoot: true })),
			),
	],
	[
		'reorder a root section',
		r => {
			r.sections.getParentSectionOfSection.mockResolvedValue(null);
			return new MoveSectionHandler(r.exams, r.sections).execute(
				new MoveSectionCommand(new MoveSectionCommandPayload({ id: 's1', index: 1 })),
			);
		},
	],
	[
		'reorder a nested section',
		r =>
			new MoveSectionHandler(r.exams, r.sections).execute(
				new MoveSectionCommand(new MoveSectionCommandPayload({ id: 's11', index: 1 })),
			),
	],
	[
		'move a question to another section',
		r =>
			new MoveQuestionHandler(r.sections).execute(
				new MoveQuestionCommand(new MoveQuestionCommandPayload({ id: 'q9', sectionId: 's2' })),
			),
	],
	[
		'reorder a question',
		r =>
			new MoveQuestionHandler(r.sections).execute(
				new MoveQuestionCommand(new MoveQuestionCommandPayload({ id: 'q1', index: 1 })),
			),
	],
];

describe('management mutations on an approved exam (C28)', () => {
	it.each(cases)('%s is a 409', async (_name, run) => {
		const r = repos();
		await expect(run(r)).rejects.toBeInstanceOf(ConflictException);
		expectNothingSaved(r);
	});

	it('deleting an approved exam is allowed (C27)', async () => {
		const r = repos();
		await new DeleteExamHandler(r.exams, r.outbox as never).execute(
			new DeleteExamCommand(new DeleteExamCommandPayload('e1')),
		);
		expect(r.exams.delete).toHaveBeenCalledTimes(1);
		expect(r.outbox.add).toHaveBeenCalledWith('exam.exam.deleted', { resourceId: 'e1' });
	});
});
