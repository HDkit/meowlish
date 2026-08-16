import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { IeltsLExamSeeder } from './exam-ielts-l';
import { IeltsRExamSeeder } from './exam-ielts-r';
import { ToeicLrExamSeeder } from './exam-toeic-lr';
import { Prisma, PrismaClient } from '@prisma-client/exam';

// i'm seeding it

// order in this seeder is assigned value incrementing from 1, however in production, order is assigned by the server algo and is not as simple as in the seeder
// just keep that in mind

export async function seedExams(prisma: PrismaClient) {
	const tags = await prisma.tag.findMany();
	const tagsMap = new Map(tags.map(tag => [tag.name.toLowerCase(), tag.id]));

	const tagNamesToIdInputs = (names: string[]): { tagId: string }[] => {
		return names
			.map(n => {
				n = n.toLowerCase();
				if (!tagsMap.has(n)) console.warn(`Database does not have tag ${n}`);
				return { tagId: tagsMap.get(n) };
			})
			.filter((inp): inp is { tagId: string } => !!inp.tagId);
	};

	// 1
	const toeicDefaultLRExam: Prisma.ExamCreateInput = new ToeicLrExamSeeder(
		tagNamesToIdInputs,
	).seed();

	// 2
	const ieltsDefaultLExam: Prisma.ExamCreateInput = new IeltsLExamSeeder(tagNamesToIdInputs).seed();

	// 3
	const ieltsDefaultRExam: Prisma.ExamCreateInput = new IeltsRExamSeeder(tagNamesToIdInputs).seed();

	// 4
	const ieltsDefaultWritingExam: Prisma.ExamCreateInput = {
		createdBy: 'admin-id',
		id: '4',
		title: 'IELTS Writing 1',
		duration: 60 * 60,
		status: ExamStatus.Approved,
		examTags: {
			createMany: { data: tagNamesToIdInputs(['IELTS', 'Writing']), skipDuplicates: true },
		},
		sections: {
			create: [
				{
					order: 1,
					contentType: SectionType.Question,
					questions: {
						create: [
							{
								order: 1,
								content: `The graph below shows the number of inquiries received by the Tourist Information Office in one city over a six-month period in 2011.
                  Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

                  #BEGIN_DESCRIPTION

                  Chart type: Line graph
                  Topic: Number of enquiries received by a Tourist Information Office
                  Time period: January to June (6 months)
                  Units: Number of enquiries
                  Categories: In person, By telephone, By letter/email

                  Data (approximate values)

                  +January:

                  In person: about 400
                  Telephone: about 900
                  Letter/email: about 750

                  +February:

                  In person: about 600
                  Telephone: about 800
                  Letter/email: about 700

                  +March:

                  In person: about 800
                  Telephone: about 1000
                  Letter/email: about 700

                  +April:

                  In person: about 1200
                  Telephone: about 1000
                  Letter/email: about 550

                  +May:

                  In person: about 1600
                  Telephone: about 1400
                  Letter/email: about 350

                  +June:

                  In person: about 1900
                  Telephone: about 1600
                  Letter/email: about 350

                  Acceptable numeric tolerance: ±50 enquiries.

                  Key overall trends (must be identifiable in strong answers)

                  In-person enquiries increased sharply throughout the period, showing the largest growth overall.
                  Telephone enquiries showed a moderate overall increase, with a small drop early on and stronger growth toward the end.
                  Letter/email enquiries decreased steadily over the six months.
                  By the end of the period, in-person enquiries were the highest, while letter/email enquiries were the lowest.

                  Key comparison points

                  In January, telephone enquiries were the highest.
                  In April, in-person enquiries overtook telephone enquiries.
                  Letter/email enquiries showed a continuous downward trend across all months.
                  In June, in-person enquiries reached the highest value (around 1900), telephone was second (around 1600), and letter/email remained lowest (around 350).

                  Expected overview content (for IELTS scoring)

                  A valid overview should mention:

                  A strong rise in in-person enquiries.
                  A moderate overall increase in telephone enquiries.
                  A steady decline in letter/email enquiries.
                  In-person becoming the dominant method by the end of the period.

                  Scoring guidance indicators

                  High-quality responses should:

                  Include a clear overview summarizing the main trends.
                  Describe overall trends rather than listing only numbers.
                  Make comparisons between categories.
                  Use selected numerical data to support descriptions.
                  Avoid listing all values without interpretation.

                  Lower-quality responses often:

                  Omit an overview.
                  Focus only on numbers without describing trends.
                  Misidentify which category increases or decreases.
                  Fail to compare categories.

                  #END_DESCRIPTION`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
				{
					order: 2,
					contentType: SectionType.Question,
					questions: {
						create: [
							{
								order: 1,
								content: `Some people think that it is more beneficial to take part in sports which are played in teams, like football,
                while other people think that taking part in individual sports, like tennis or swimming, is better.
                Discuss both views and give your own opinion.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	await Promise.all(
		[toeicDefaultLRExam, ieltsDefaultLExam, ieltsDefaultRExam, ieltsDefaultWritingExam].map(
			async exam => await prisma.exam.create({ data: exam }),
		),
	);
}
