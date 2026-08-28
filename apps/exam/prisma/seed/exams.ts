import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { GrammarVocabExamSeeder } from './exam-grammar-vocab';
import { IeltsLExamSeeder } from './exam-ielts-l';
import { IeltsRExamSeeder } from './exam-ielts-r';
import { IeltsR2ExamSeeder } from './exam-ielts-r-2';
import { ToeicLrExamSeeder } from './exam-toeic-lr';
import { ToeicLr2ExamSeeder } from './exam-toeic-lr-2';
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

	// 5
	const toeicLr2Exam: Prisma.ExamCreateInput = new ToeicLr2ExamSeeder(tagNamesToIdInputs).seed();

	// 6
	const ieltsR2Exam: Prisma.ExamCreateInput = new IeltsR2ExamSeeder(tagNamesToIdInputs).seed();

	// 7
	const grammarVocabExam: Prisma.ExamCreateInput = new GrammarVocabExamSeeder(
		tagNamesToIdInputs,
	).seed();

	// 4
	const ieltsDefaultWritingExam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
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

	const ieltsWriting2Exam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
		id: '8',
		title: 'IELTS Writing 2',
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
								content: `The bar chart below shows the percentage of the population living in urban areas in six different regions of the world in 1950, 2000, and projected figures for 2050.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

#BEGIN_DESCRIPTION

Chart type: Bar chart
Topic: Urban population percentage by region
Time period: 1950, 2000, 2050 (projected)
Regions: North America, South America, Europe, Africa, Asia, Oceania

Data (approximate values)

+1950:
North America: about 64%
South America: about 42%
Europe: about 52%
Africa: about 14%
Asia: about 17%
Oceania: about 62%

+2000:
North America: about 79%
South America: about 75%
Europe: about 73%
Africa: about 37%
Asia: about 48%
Oceania: about 70%

+2050 (projected):
North America: about 87%
South America: about 88%
Europe: about 82%
Africa: about 62%
Asia: about 66%
Oceania: about 75%

Acceptable numeric tolerance: ±3 percentage points.

Key overall trends (must be identifiable in strong answers)
Urbanization is increasing across all six regions over the entire period.
North America and Oceania had the highest urban populations initially, while Africa and Asia had the lowest.
Africa is projected to experience the most dramatic growth, nearly quadrupling its urban share.
South America is expected to overtake North America by 2050.

Key comparison points
In 1950, North America had the highest urban population, while Africa had the lowest.
By 2000, South America saw the steepest increase among all regions.
Africa and Asia both had similar low starting points but Africa's growth outpaces Asia by 2050.
Europe's urban growth is relatively modest compared to other regions.

Expected overview content (for IELTS scoring)
A valid overview should mention:
A global trend of increasing urbanization across all regions.
Africa and Asia starting with the lowest but experiencing the fastest growth.
North America and Oceania maintaining the highest percentages throughout.

Scoring guidance indicators
High-quality responses should:
Include a clear overview summarizing main trends.
Make comparisons between regions.
Use selected data to support descriptions.
Highlight the projected growth for Africa and Asia.

Lower-quality responses often:
Omit an overview or list data without grouping.
Describe each region in isolation without comparison.
Fail to note the projected nature of 2050 data.
Misread the chart type or units.

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
								content: `Some people believe that technological advancements have made our lives more complex and stressful, while others argue that technology has simplified our daily routines and improved our quality of life.
Discuss both these views and give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	const ieltsWriting3Exam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
		id: '9',
		title: 'IELTS Writing 3',
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
								content: `The pie charts below show the percentage of energy generated from different sources in a country in 2000 and 2020.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

#BEGIN_DESCRIPTION

Chart type: Pie charts
Topic: Energy generation by source
Time period: 2000 and 2020
Sources: Coal, Natural Gas, Nuclear, Solar, Wind, Hydroelectric, Other

Data (approximate values)

+2000:
Coal: 45%
Natural Gas: 25%
Nuclear: 12%
Hydroelectric: 10%
Wind: 3%
Solar: 1%
Other: 4%

+2020:
Coal: 28%
Natural Gas: 22%
Nuclear: 10%
Hydroelectric: 8%
Wind: 15%
Solar: 12%
Other: 5%

Acceptable numeric tolerance: ±2 percentage points.

Key overall trends (must be identifiable in strong answers)
Fossil fuel dominance (coal + natural gas) decreased from 70% to 50%.
Renewable energy sources (wind + solar) grew significantly from 4% to 27%.
Coal saw the largest decline, dropping by 17 percentage points.
Wind and solar showed the most dramatic growth.

Key comparison points
Coal was the dominant source in both years but its share fell substantially.
Solar and wind were negligible in 2000 but became major contributors by 2020.
Natural gas and nuclear remained relatively stable.
Hydroelectric power saw a slight decline.

Expected overview content (for IELTS scoring)
A valid overview should mention:
A shift from fossil fuels toward renewable energy over the 20-year period.
Coal remaining the largest source despite significant decline.
The substantial growth of wind and solar energy.

Scoring guidance indicators
High-quality responses should:
Identify the overarching shift toward renewables.
Quote specific figures to support comparisons.
Group related sources (fossil fuels vs renewables).
Describe changes in proportions rather than absolute values.

Lower-quality responses often:
Describe each pie chart separately without comparison.
Fail to mention the decline in fossil fuel share.
Use inappropriate language for proportions.
Omit an overview or key trends.

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
								content: `In many countries, the gap between the rich and the poor is widening. What problems can this cause, and what measures can be taken to reduce this inequality?
Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	const ieltsWriting4Exam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
		id: '10',
		title: 'IELTS Writing 4',
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
								content: `The table below shows the export values (in billions of dollars) of five major product categories from Country X to three different regions in 2015 and 2020.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

#BEGIN_DESCRIPTION

Table type: Export values by product category and region
Time period: 2015 and 2020
Units: Billions of dollars
Regions: Europe, North America, Asia
Product categories: Machinery, Electronics, Textiles, Chemicals, Food

Data

+Europe 2015:
Machinery: 45
Electronics: 32
Textiles: 18
Chemicals: 25
Food: 12

+Europe 2020:
Machinery: 48
Electronics: 38
Textiles: 15
Chemicals: 27
Food: 14

+North America 2015:
Machinery: 38
Electronics: 28
Textiles: 22
Chemicals: 15
Food: 20

+North America 2020:
Machinery: 35
Electronics: 34
Textiles: 18
Chemicals: 17
Food: 22

+Asia 2015:
Machinery: 30
Electronics: 42
Textiles: 35
Chemicals: 12
Food: 8

+Asia 2020:
Machinery: 36
Electronics: 55
Textiles: 30
Chemicals: 16
Food: 10

Acceptable numeric tolerance: ±1 billion.

Key overall trends (must be identifiable in strong answers)
Asia was the largest export market overall and showed the strongest growth.
Electronics exports increased across all three regions, with the biggest rise to Asia.
Textile exports declined to all three regions.
Europe remained the largest market for machinery exports.

Key comparison points
Asia imported the most electronics and textiles but the least food and chemicals.
Europe was the biggest importer of machinery and chemicals.
North America was the largest market for food exports.
Total exports to Asia grew the most, while exports to Europe saw the least change.

Expected overview content (for IELTS scoring)
A valid overview should mention:
Overall export growth, particularly to Asia.
Electronics as the fastest-growing category.
Textiles as the only category with universal decline.
Europe and Asia dominating different product sectors.

Scoring guidance indicators
High-quality responses should:
Identify the overarching regional and product trends.
Make comparisons across both regions and categories.
Quote supporting data selectively.
Group data intelligently rather than list every figure.

Lower-quality responses often:
Describe cell by cell without synthesis.
Fail to identify the fastest-growing or declining categories.
Omit regional comparisons.
Provide too much or irrelevant numerical detail.

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
								content: `Some people think that governments should invest more in public transportation systems to reduce traffic congestion and pollution. Others believe that building more roads and highways is a better solution.
Discuss both these views and give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	const ieltsWriting5Exam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
		id: '11',
		title: 'IELTS Writing 5',
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
								content: `The diagram below shows the process of how a volcanic island is formed and the stages of its development over time.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

#BEGIN_DESCRIPTION

Diagram type: Process / Sequential stages
Topic: Formation and development of a volcanic island
Stages: 5 stages (from underwater volcanic activity to erosion)

Stage 1: Magma rises from the Earth's mantle through a fissure in the oceanic crust. The magma erupts underwater, building layers of volcanic rock on the ocean floor.

Stage 2: Continued eruptions cause the volcanic cone to grow taller until it breaks the surface of the ocean. Steam and ash are released at this point.

Stage 3: The volcano emerges above sea level, forming an island. Lava flows cool and solidify, expanding the land area. Vegetation begins to appear on the cooled lava.

Stage 4: Eruptions cease and the volcano becomes dormant. Erosion from wind, rain, and waves gradually reshapes the island. Soil forms from weathered volcanic rock, supporting more diverse plant life.

Stage 5: Over millions of years, erosion reduces the island's height and size. The island may eventually subside back below sea level, forming a seamount or guyot (flat-topped underwater mountain). Coral reefs may form around the remaining land.

Key features (must be identifiable in strong answers)
The process begins underwater with magma rising from the mantle.
The volcano grows through repeated eruptions until it emerges above sea level.
After eruptions stop, erosion becomes the dominant force.
The final stage involves the island sinking back below the ocean surface.

Scoring guidance indicators
High-quality responses should:
Describe each stage in the correct sequence.
Provide an overview of the entire process (formation, emergence, erosion, submergence).
Use appropriate linking words to show sequence.
Include relevant details about each stage without being overly technical.

Lower-quality responses often:
Describe stages out of order.
Fail to provide an overview of the overall process.
Focus on trivial details while missing the main sequence.
Use inappropriate or overly technical language.

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
								content: `Many young people today spend a large amount of their time on social media platforms. What are the advantages and disadvantages of this trend?
Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	const ieltsWriting6Exam: Prisma.ExamCreateInput = {
		createdBy: 'admin',
		id: '12',
		title: 'IELTS Writing 6',
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
								content: `The maps below show the changes that have taken place in the coastal town of Seaville between 1990 and 2020.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.

#BEGIN_DESCRIPTION

Map type: Town development over time
Location: Seaville (coastal town)
Time period: 1990 vs 2020

+1990 features:
Fishing port (north-west)
Small beach (south-west)
Farmland (east)
Small residential area (north-east)
Woodland (south-east)
Single road connecting port to residential area
One small hotel near the beach
No commercial or industrial zones

+2020 features:
Fishing port expanded and modernized with a marina
Beach developed with a promenade, cafes, and a public swimming area
Farmland replaced by a housing estate and shopping center
Residential area expanded significantly
Woodland reduced to a small park
New road network with a coastal road and bypass
Two large hotels and several restaurants built along the seafront
A commercial district developed behind the beach area
Industrial zone established north of the port

Key changes (must be identifiable in strong answers)
The most dramatic change is the urbanization of farmland into housing and commercial zones.
The beach area transformed from natural to developed tourism infrastructure.
The transport network expanded significantly to support growth.
The fishing port modernized, indicating a shift from fishing to tourism.

Comparison points
The town shifted from a fishing and agricultural economy toward tourism and commerce.
Green space (farmland + woodland) was largely replaced by built-up areas.
The coastline became the focal point of development.
The population capacity of the town clearly increased.

Expected overview content (for IELTS scoring)
A valid overview should mention:
Seaville underwent extensive urbanization and tourism development.
Agricultural and natural areas were replaced by residential and commercial zones.
The town's economy shifted from fishing and farming to tourism and services.

Scoring guidance indicators
High-quality responses should:
Identify the most significant changes.
Make comparisons between the two time periods.
Group related developments together.
Use appropriate language for describing change (transformed, replaced, expanded, etc.).

Lower-quality responses often:
Describe each map separately without comparison.
List every change without prioritizing significance.
Fail to note the economic shift from fishing/agriculture to tourism.
Omit an overview summarizing the overall transformation.

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
								content: `Some people believe that universities should focus on providing academic knowledge and preparing students for careers, while others think that universities should also emphasize personal development and life skills.
Discuss both these views and give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.`,
								type: QuestionType.Writing,
								questionTags: { create: tagNamesToIdInputs(['IELTS Writing T1-T2']) },
							},
						],
					},
				},
			],
		},
	};

	const allExams = [
		toeicDefaultLRExam,
		ieltsDefaultLExam,
		ieltsDefaultRExam,
		ieltsDefaultWritingExam,
		toeicLr2Exam,
		ieltsR2Exam,
		grammarVocabExam,
		ieltsWriting2Exam,
		ieltsWriting3Exam,
		ieltsWriting4Exam,
		ieltsWriting5Exam,
		ieltsWriting6Exam,
	];

	for (const exam of allExams) {
		try {
			await prisma.exam.create({ data: exam });
		} catch (e: any) {
			if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
				console.warn(`Exam "${exam.title}" (id: ${exam.id}) already exists, skipping.`);
			} else {
				throw e;
			}
		}
	}
}
