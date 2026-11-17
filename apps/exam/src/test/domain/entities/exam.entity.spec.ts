import { Exam } from '../../../domain/entities/exam.entity';
import { ExamStatus } from '../../../enums/exam-status.enum';
import { BadRequestException } from '@nestjs/common';

const newExam = (duration = 600) =>
	new Exam({
		title: 't',
		duration: duration,
		createdBy: 'mod',
		status: ExamStatus.Pending,
		description: null,
		sections: [],
		tags: [],
	});

describe('Exam duration (C14)', () => {
	it.each([0, -60, 1.5])('rejects duration %p on create', duration => {
		expect(() => newExam(duration)).toThrow(BadRequestException);
	});

	it.each([0, -60, 1.5])('rejects duration %p on update', duration => {
		const exam = newExam();
		expect(() => exam.updateDetails({ duration: duration })).toThrow(BadRequestException);
		expect(exam.duration).toBe(600);
	});

	it('accepts a positive duration on update', () => {
		const exam = newExam();
		exam.updateDetails({ duration: 1200 });
		expect(exam.duration).toBe(1200);
	});
});
