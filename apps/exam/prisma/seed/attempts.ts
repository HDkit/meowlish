import { SectionType } from '../../src/enums/section-type.enum';
import { PrismaClient } from '@prisma-client/exam';
import { randomInt } from 'crypto';

export async function seedAttempts(prisma: PrismaClient) {
	const existingAttempts = await prisma.attempt.findMany({
		where: { id: { in: ['1', '2', '3', '4', '5', '6'] } },
	});
	if (existingAttempts.length >= 6) {
		console.warn('Attempts already seeded, skipping.');
		return;
	}

	const exam1q = await prisma.question.findMany({
		where: { section: { contentType: SectionType.Question, examId: '1' } },
		include: { choices: true },
	});

	const attempt1Choices: [string, string[]][] = exam1q.map(q => {
		const a = q.choices.filter(c => c.isCorrect).map(c => c.key);
		return [q.id, a];
	});

	const attempt2Choices: [string, string[]][] = exam1q.map(q => {
		const a = q.choices.filter(c => !c.isCorrect).map(c => c.key);
		return [q.id, a];
	});

	const attempt3Choices: [string, string[]][] = exam1q.map(q => {
		const choiceLength = q.choices.length;
		const a = choiceLength ? q.choices[randomInt(0, choiceLength)].key : 'those who know';
		return [q.id, [a]];
	});

	const exam2q = await prisma.question.findMany({
		where: { section: { contentType: SectionType.Question, examId: '2' } },
		include: { choices: true },
	});

	const attempt4Choices: [string, string[]][] = exam2q.map(q => {
		const a = q.choices.filter(c => c.isCorrect).map(c => c.key);
		return [q.id, a];
	});

	const attempt5Choices: [string, string[]][] = exam2q.map(q => {
		const a = q.choices.filter(c => !c.isCorrect).map(c => c.key);
		return [q.id, a];
	});

	const exam3q = await prisma.question.findMany({
		where: { section: { contentType: SectionType.Question, examId: '3' } },
		include: { choices: true },
	});

	const attempt6Choices: [string, string[]][] = exam3q.map(q => {
		const choiceLength = q.choices.length;
		const a = choiceLength ? q.choices[randomInt(0, choiceLength)].key : 'those who know';
		return [q.id, [a]];
	});

	await prisma.attempt.createMany({
		data: [
			{
				id: '1',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '1',
				order: 1,
				startedAt: new Date(),
			},
			{
				id: '2',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '1',
				order: 2,
				startedAt: new Date(Date.now() + 10 * 60 * 1000),
			},
			{
				id: '3',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '1',
				order: 3,
				startedAt: new Date(Date.now() + 20 * 60 * 1000),
			},
			{
				id: '4',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '2',
				order: 1,
				startedAt: new Date(Date.now() + 30 * 60 * 1000),
			},
			{
				id: '5',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '2',
				order: 2,
				startedAt: new Date(Date.now() + 40 * 60 * 1000),
			},
			{
				id: '6',
				attemptedBy: 'admin',
				durationLimit: 1000,
				isStrict: false,
				examId: '3',
				order: 1,
				startedAt: new Date(Date.now() + 50 * 60 * 1000),
			},
		],
	});

	await prisma.attemptResponse.createMany({
		data: [
			...attempt1Choices.map(c => ({ attemptId: '1', questionId: c[0], answers: c[1] })),
			...attempt2Choices.map(c => ({ attemptId: '2', questionId: c[0], answers: c[1] })),
			...attempt3Choices.map(c => ({ attemptId: '3', questionId: c[0], answers: c[1] })),
			...attempt4Choices.map(c => ({ attemptId: '4', questionId: c[0], answers: c[1] })),
			...attempt5Choices.map(c => ({ attemptId: '5', questionId: c[0], answers: c[1] })),
			...attempt6Choices.map(c => ({ attemptId: '6', questionId: c[0], answers: c[1] })),
		],
	});
}
