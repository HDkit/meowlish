import { ExamStatus } from '../../enums/exam-status.enum';
import { QuestionType } from '../../enums/question-type.enum';
import { SectionType } from '../../enums/section-type.enum';
import { ExamPrismaRepositoryImpl } from './exam.prisma.repository.impl';
import { QuestionPrismaRepositoryImpl } from './question.prisma.repository.impl';
import { SectionPrismaRepositoryImpl } from './section.prisma.repository.impl';
import { NotFoundException } from '@nestjs/common';

jest.mock('@prisma-client/exam', () => ({
	Prisma: {
		PrismaClientKnownRequestError: class extends Error {
			constructor(public code: string) {
				super(code);
			}
		},
	},
}));

const { Prisma } = jest.requireMock<{
	Prisma: { PrismaClientKnownRequestError: new (code: string) => Error };
}>('@prisma-client/exam');

// C8: section and question tags are tag ids, like exam tags.
const tagRows = [{ tagId: 'tag-1', tag: { name: 'Grammar' } }];
const exam = { id: 'e1', version: 1, status: ExamStatus.Pending };

const link = () => ({
	create: jest.fn().mockResolvedValue({}),
	delete: jest.fn().mockResolvedValue({}),
	deleteMany: jest.fn().mockResolvedValue({}),
});

const setup = () => {
	const tx = {
		exam: {
			findUnique: jest.fn().mockResolvedValue({
				...exam,
				title: 't',
				duration: 600,
				createdBy: 'mod',
				description: null,
				sections: [],
				examTags: tagRows,
			}),
			update: jest.fn().mockResolvedValue({}),
		},
		section: {
			findUnique: jest.fn().mockResolvedValue({
				id: 's1',
				directive: '',
				name: null,
				parentId: null,
				examId: 'e1',
				exam: exam,
				contentType: SectionType.Question,
				questions: [],
				childSections: [],
				sectionFiles: [],
				sectionTags: tagRows,
			}),
			update: jest.fn().mockResolvedValue({}),
		},
		question: {
			findUnique: jest.fn().mockResolvedValue({
				id: 'q1',
				sectionId: 's1',
				section: { exam: exam },
				choices: [],
				content: '',
				explanation: '',
				points: 1,
				type: QuestionType.MultipleChoiceSingle,
				questionFiles: [],
				questionTags: tagRows,
			}),
			update: jest.fn().mockResolvedValue({}),
		},
		examTag: link(),
		sectionTag: link(),
		questionTag: link(),
	};
	const txHost = { tx: tx, withTransaction: (fn: () => Promise<void>) => fn() };
	return {
		tx: tx,
		exams: new ExamPrismaRepositoryImpl(txHost as never),
		sections: new SectionPrismaRepositoryImpl(txHost as never),
		questions: new QuestionPrismaRepositoryImpl(txHost as never),
	};
};

describe('section tags are tag ids (C8)', () => {
	it('loads the tag ids', async () => {
		const { sections } = setup();
		const section = await sections.findOne('s1');
		expect([...(section?.tags ?? [])]).toEqual(['tag-1']);
	});

	it('writes and removes the link by tag id', async () => {
		const { sections, tx } = setup();
		const section = await sections.findOne('s1');
		section?.removeTag('tag-1');
		section?.addTag('tag-2');
		if (section) await sections.save(section);
		expect(tx.sectionTag.delete).toHaveBeenCalledWith({
			where: { sectionId_tagId: { sectionId: 's1', tagId: 'tag-1' } },
		});
		expect(tx.sectionTag.create).toHaveBeenCalledWith({
			data: { sectionId: 's1', tagId: 'tag-2' },
		});
	});

	it('rejects an unknown tag id with NotFound', async () => {
		const { sections, tx } = setup();
		tx.sectionTag.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('P2003'));
		const section = await sections.findOne('s1');
		section?.addTag('nope');
		await expect(section && sections.save(section)).rejects.toThrow(NotFoundException);
	});
});

describe('question tags are tag ids (C8)', () => {
	it('loads the tag ids', async () => {
		const { questions } = setup();
		const question = await questions.findOne('q1');
		expect([...(question?.tags ?? [])]).toEqual(['tag-1']);
	});

	it('writes and removes the link by tag id', async () => {
		const { questions, tx } = setup();
		const question = await questions.findOne('q1');
		question?.removeTag('tag-1');
		question?.addTag('tag-2');
		if (question) await questions.save(question);
		expect(tx.questionTag.delete).toHaveBeenCalledWith({
			where: { questionId_tagId: { questionId: 'q1', tagId: 'tag-1' } },
		});
		expect(tx.questionTag.create).toHaveBeenCalledWith({
			data: { questionId: 'q1', tagId: 'tag-2' },
		});
	});

	it('rejects an unknown tag id with NotFound', async () => {
		const { questions, tx } = setup();
		tx.questionTag.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('P2003'));
		const question = await questions.findOne('q1');
		question?.addTag('nope');
		await expect(question && questions.save(question)).rejects.toThrow(NotFoundException);
	});
});

describe('exam tags are tag ids (C8)', () => {
	it('loads the tag ids', async () => {
		const { exams } = setup();
		const found = await exams.findOne('e1');
		expect([...(found?.tags ?? [])]).toEqual(['tag-1']);
	});

	it('rejects an unknown tag id with NotFound', async () => {
		const { exams, tx } = setup();
		tx.examTag.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('P2003'));
		const found = await exams.findOne('e1');
		found?.addTag('nope');
		await expect(found && exams.save(found)).rejects.toThrow(NotFoundException);
	});
});
