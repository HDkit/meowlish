import { Exam, ExamId, ExamSection } from '../../../domain/entities/exam.entity';
import { Section, SectionChild } from '../../../domain/entities/section.entity';
import { ExamStatus } from '../../../enums/exam-status.enum';
import { SectionType } from '../../../enums/section-type.enum';

// C6: move/insert by index, for exam sections and section children.
const IDS = ['a', 'b', 'c', 'd'];

const expectedMove = (ids: string[], id: string, toIdx: number): string[] => {
	const rest = ids.filter(x => x !== id);
	const target = toIdx < 0 || toIdx >= ids.length ? rest.length : toIdx;
	rest.splice(target, 0, id);
	return rest;
};

const expectedInsert = (ids: string[], id: string, idx: number): string[] => {
	const copy = [...ids];
	copy.splice(idx < 0 || idx > ids.length ? ids.length : idx, 0, id);
	return copy;
};

type Ordered = { id: string; order: number };

const assertOrder = (items: Ordered[], expected: string[]) => {
	// in-memory array order
	expect(items.map(i => i.id)).toEqual(expected);
	// persisted order (what a reload would see)
	expect(items.toSorted((x, y) => x.order - y.order).map(i => i.id)).toEqual(expected);
	expect(new Set(items.map(i => i.order)).size).toBe(items.length);
};

const newExam = (orders: number[]) =>
	new Exam({
		id: new ExamId('e1', 1),
		title: 't',
		duration: 600,
		createdBy: 'mod',
		status: ExamStatus.Pending,
		description: null,
		sections: IDS.slice(0, orders.length).map((id, i) => new ExamSection(id, orders[i])),
		tags: [],
	});

const newSection = (orders: number[], contentType = SectionType.Question) =>
	new Section({
		id: 'p',
		examId: new ExamId('e1', 1),
		examStatus: ExamStatus.Pending,
		contentType: contentType,
		directive: '',
		children: IDS.slice(0, orders.length).map((id, i) => new SectionChild(id, orders[i])),
		tags: [],
		fileIds: [],
	});

const spaced = [0, 1024, 2048, 3072];
const packed = [0, 1, 2, 3]; // forces a rebalance on middle placement

const moveCases = IDS.flatMap(id => [-1, 0, 1, 2, 3, 4, 10].map(to => [id, to] as const));
const insertCases = [-1, 0, 1, 2, 3, 4, 5, 10];

describe.each([
	['spaced', spaced],
	['packed', packed],
])('C6 ordering (%s orders)', (_label, orders) => {
	describe('Exam.moveSection', () => {
		it.each(moveCases)('moves %s to index %p', (id, to) => {
			const exam = newExam(orders);
			exam.moveSection(id, to);
			assertOrder(exam.sections, expectedMove(IDS, id, to));
		});
	});

	describe('Exam.addSection (insert at index)', () => {
		it.each(insertCases)('inserts at index %p', idx => {
			const exam = newExam(orders);
			exam.addSection('x', idx);
			assertOrder(exam.sections, expectedInsert(IDS, 'x', idx));
		});
	});

	describe('Exam.createSection (insert at index)', () => {
		it.each(insertCases)('inserts at index %p', idx => {
			const exam = newExam(orders);
			const id = exam.createSection(idx);
			assertOrder(exam.sections, expectedInsert(IDS, id, idx));
		});
	});

	describe('Section.moveChild', () => {
		it.each(moveCases)('moves %s to index %p', (id, to) => {
			const section = newSection(orders);
			section.moveChild(id, to);
			assertOrder(section.children, expectedMove(IDS, id, to));
		});
	});

	describe('Section.addQuestion (insert at index)', () => {
		it.each(insertCases)('inserts at index %p', idx => {
			const section = newSection(orders);
			section.addQuestion('x', idx);
			assertOrder(section.children, expectedInsert(IDS, 'x', idx));
		});
	});

	describe('Section.createSection (insert at index)', () => {
		it.each(insertCases)('inserts at index %p', idx => {
			const section = newSection(orders, SectionType.Section);
			const id = section.createSection(idx);
			assertOrder(section.children, expectedInsert(IDS, id, idx));
		});
	});
});

describe('C6 ordering on empty / single lists', () => {
	it('inserts into an empty exam', () => {
		const exam = newExam([]);
		exam.addSection('x', 3);
		assertOrder(exam.sections, ['x']);
	});

	it('inserts into an empty section at index 0', () => {
		const section = newSection([]);
		section.addQuestion('x', 0);
		assertOrder(section.children, ['x']);
	});

	it('inserts before the only child', () => {
		const section = newSection([0]);
		section.addQuestion('x', 0);
		assertOrder(section.children, ['x', 'a']);
	});
});
