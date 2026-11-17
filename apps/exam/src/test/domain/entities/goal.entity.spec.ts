import { assertValidGoalTarget } from '../../../domain/entities/goal.entity';
import { BadRequestException } from '@nestjs/common';

// C25: goal targets are in each test's own scale, half bands included.

describe('assertValidGoalTarget (C25)', () => {
	it.each([
		['IELTS', 0],
		['IELTS', 6.5],
		['IELTS', 9],
		['TOEIC', 10],
		['TOEIC', 755],
		['TOEIC', 990],
		['TOEFL', 0],
		['TOEFL', 87],
		['TOEFL', 120],
		['VSTEP', 0],
		['VSTEP', 7.5],
		['VSTEP', 10],
	])('accepts %s %p', (type, target) => {
		expect(() => assertValidGoalTarget({ type: type, target: target })).not.toThrow();
	});

	it.each([
		['IELTS', -0.5],
		['IELTS', 6.3],
		['IELTS', 9.5],
		['IELTS', 750],
		['TOEIC', 5],
		['TOEIC', 0],
		['TOEIC', 752],
		['TOEIC', 995],
		['TOEFL', 87.5],
		['TOEFL', 121],
		['TOEFL', -1],
		['VSTEP', 7.25],
		['VSTEP', 10.5],
		['IELTS', Number.NaN],
		['IELTS', Number.POSITIVE_INFINITY],
	])('rejects %s %p with a 400', (type, target) => {
		expect(() => assertValidGoalTarget({ type: type, target: target })).toThrow(
			BadRequestException,
		);
	});

	it('rejects an unknown type with a 400', () => {
		expect(() => assertValidGoalTarget({ type: 'SAT', target: 1200 })).toThrow(BadRequestException);
	});
});
