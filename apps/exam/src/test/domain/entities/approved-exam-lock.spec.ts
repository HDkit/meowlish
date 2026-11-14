import { Exam, ExamId } from '../../../domain/entities/exam.entity';
import { Question } from '../../../domain/entities/question.entity';
import { Section } from '../../../domain/entities/section.entity';
import { ExamStatus } from '../../../enums/exam-status.enum';
import { QuestionType } from '../../../enums/question-type.enum';
import { SectionType } from '../../../enums/section-type.enum';
import { ConflictException } from '@nestjs/common';

// C28: an approved exam is frozen; tags were the one mutation the aggregates still allowed.

const exam = (status: ExamStatus) =>
	new Exam({
		title: 't',
		duration: 600,
		createdBy: 'mod',
		status: status,
		description: null,
		sections: [],
		tags: ['t1'],
	});

const section = (status: ExamStatus) =>
	new Section({
		id: 's1',
		examId: new ExamId('e1', 1),
		examStatus: status,
		children: [],
		contentType: SectionType.Question,
		directive: '',
		tags: ['t1'],
		fileIds: [],
	});

const question = (status: ExamStatus) =>
	new Question({
		id: 'q1',
		examId: new ExamId('e1', 1),
		examStatus: status,
		sectionId: 's1',
		content: '',
		type: QuestionType.Writing,
		points: 1,
		explanation: '',
		choices: [],
		tags: ['t1'],
		fileIds: [],
	});

describe('approved exam lock (C28)', () => {
	it.each([ExamStatus.Pending, ExamStatus.Rejected, ExamStatus.Approved])(
		'refuses to change an approved exam to %s',
		status => {
			const e = exam(ExamStatus.Approved);
			expect(() => e.updateStatus(status)).toThrow(ConflictException);
			expect(e.status).toBe(ExamStatus.Approved);
			expect(e.getUncommittedEvents()).toHaveLength(0);
		},
	);

	it('still lets a pending or rejected exam be reviewed', () => {
		const pending = exam(ExamStatus.Pending);
		pending.updateStatus(ExamStatus.Approved);
		expect(pending.status).toBe(ExamStatus.Approved);
		const rejected = exam(ExamStatus.Rejected);
		rejected.updateStatus(ExamStatus.Pending);
		expect(rejected.status).toBe(ExamStatus.Pending);
	});

	it.each([
		['exam', () => exam(ExamStatus.Approved)],
		['section', () => section(ExamStatus.Approved)],
		['question', () => question(ExamStatus.Approved)],
	])('refuses tag changes on an approved %s', (_name, make) => {
		const aggregate = make();
		expect(() => aggregate.addTag('t2')).toThrow(ConflictException);
		expect(() => aggregate.removeTag('t1')).toThrow(ConflictException);
		expect([...aggregate.tags]).toEqual(['t1']);
		expect(aggregate.getUncommittedEvents()).toHaveLength(0);
	});

	it.each([
		['exam', () => exam(ExamStatus.Pending)],
		['section', () => section(ExamStatus.Pending)],
		['question', () => question(ExamStatus.Pending)],
	])('allows tag changes on a pending %s', (_name, make) => {
		const aggregate = make();
		aggregate.addTag('t2');
		aggregate.removeTag('t1');
		expect([...aggregate.tags]).toEqual(['t2']);
	});
});
