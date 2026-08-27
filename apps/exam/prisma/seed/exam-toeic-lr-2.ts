import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class ToeicLr2ExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		return {
			id: '5',
			createdBy: 'admin',
			title: 'TOEIC LR 2',
			duration: 2 * 60 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['TOEIC Listening', 'TOEIC Reading']),
					skipDuplicates: true,
				},
			},
			sections: { create: [...this.part5(), ...this.part6(), ...this.part7()] },
		};
	}

	private part5(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			{
				id: 's55',
				order: 5,
				contentType: SectionType.Question,
				questions: {
					create: [
						{
							order: 101,
							content:
								'The management team has decided ------- the annual conference to a larger venue.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'moves', isCorrect: false },
									{ key: 'B', content: 'moving', isCorrect: false },
									{ key: 'C', content: 'to move', isCorrect: true },
									{ key: 'D', content: 'moved', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Infinitives Gerunds']) },
						},
						{
							order: 102,
							content:
								'Applicants must submit their resumes ------- Friday, March 15th to be considered for the position.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'by', isCorrect: true },
									{ key: 'B', content: 'in', isCorrect: false },
									{ key: 'C', content: 'on', isCorrect: false },
									{ key: 'D', content: 'at', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 103,
							content: 'The new software is designed to help employees work more -------.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'efficient', isCorrect: false },
									{ key: 'B', content: 'efficiency', isCorrect: false },
									{ key: 'C', content: 'efficiently', isCorrect: true },
									{ key: 'D', content: 'efficiencies', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 104,
							content:
								'None of the candidates ------- satisfied the minimum qualifications for the job.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'has', isCorrect: false },
									{ key: 'B', content: 'have', isCorrect: true },
									{ key: 'C', content: 'having', isCorrect: false },
									{ key: 'D', content: 'had', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 105,
							content:
								'The contractor promised that the renovation work ------- completed by the end of the month.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'will be', isCorrect: true },
									{ key: 'B', content: 'has been', isCorrect: false },
									{ key: 'C', content: 'was being', isCorrect: false },
									{ key: 'D', content: 'had been', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Tenses']) },
						},
						{
							order: 106,
							content:
								'Mr. Tran is the most ------- employee in the accounting department, having worked there for over twenty years.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'experience', isCorrect: false },
									{ key: 'B', content: 'experienced', isCorrect: true },
									{ key: 'C', content: 'experiencing', isCorrect: false },
									{ key: 'D', content: 'experiences', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Participles']) },
						},
						{
							order: 107,
							content:
								'The city council approved the new budget, ------- allowed for increased funding to public schools.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'which', isCorrect: true },
									{ key: 'B', content: 'what', isCorrect: false },
									{ key: 'C', content: 'who', isCorrect: false },
									{ key: 'D', content: 'whom', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Relative Clauses']) },
						},
						{
							order: 108,
							content:
								'Please ------- that all safety protocols are followed during the laboratory experiment.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'insure', isCorrect: false },
									{ key: 'B', content: 'ensure', isCorrect: true },
									{ key: 'C', content: 'assure', isCorrect: false },
									{ key: 'D', content: 'endure', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 109,
							content:
								'The ------- of the new bridge will significantly reduce travel time between the two cities.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'construct', isCorrect: false },
									{ key: 'B', content: 'construction', isCorrect: true },
									{ key: 'C', content: 'constructive', isCorrect: false },
									{ key: 'D', content: 'constructing', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 110,
							content:
								'The training session was ------- informative that many employees requested a follow-up workshop.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'very', isCorrect: false },
									{ key: 'B', content: 'too', isCorrect: false },
									{ key: 'C', content: 'such', isCorrect: false },
									{ key: 'D', content: 'so', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 111,
							content:
								'The report ------- the sales figures for the last quarter and provides recommendations for improvement.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'summarizes', isCorrect: true },
									{ key: 'B', content: 'summarized', isCorrect: false },
									{ key: 'C', content: 'summarizing', isCorrect: false },
									{ key: 'D', content: 'summary', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 112,
							content:
								'If the shipment ------- by Friday, the store will not have enough inventory for the weekend sale.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'does not arrive', isCorrect: true },
									{ key: 'B', content: 'will not arrive', isCorrect: false },
									{ key: 'C', content: 'would not arrive', isCorrect: false },
									{ key: 'D', content: 'did not arrive', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Conditionals']) },
						},
						{
							order: 113,
							content: 'The marketing team is ------- a new campaign to target younger consumers.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'developing', isCorrect: true },
									{ key: 'B', content: 'development', isCorrect: false },
									{ key: 'C', content: 'develops', isCorrect: false },
									{ key: 'D', content: 'developed', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Marketing Project']) },
						},
						{
							order: 114,
							content:
								'The conference room has been ------- renovated and can now accommodate up to fifty people.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'complete', isCorrect: false },
									{ key: 'B', content: 'completely', isCorrect: true },
									{ key: 'C', content: 'completing', isCorrect: false },
									{ key: 'D', content: 'completed', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 115,
							content:
								'The new regulation will apply ------- all businesses with more than fifty employees.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'for', isCorrect: false },
									{ key: 'B', content: 'on', isCorrect: false },
									{ key: 'C', content: 'to', isCorrect: true },
									{ key: 'D', content: 'with', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
					],
				},
			},
		];
	}

	private part6(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			{
				id: 's56',
				order: 6,
				contentType: SectionType.Section,
				childSections: {
					create: [
						{
							id: 's561',
							examId: '5',
							order: 1,
							contentType: SectionType.Question,
							questions: {
								create: [
									{
										order: 116,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'are', isCorrect: false },
												{ key: 'B', content: 'is', isCorrect: true },
												{ key: 'C', content: 'have', isCorrect: false },
												{ key: 'D', content: 'has', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 117,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'In addition', isCorrect: false },
												{ key: 'B', content: 'However', isCorrect: true },
												{ key: 'C', content: 'Therefore', isCorrect: false },
												{ key: 'D', content: 'Moreover', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 118,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'propose', isCorrect: false },
												{ key: 'B', content: 'proposed', isCorrect: true },
												{ key: 'C', content: 'proposing', isCorrect: false },
												{ key: 'D', content: 'proposal', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 119,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Customers can return items within 30 days.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'We appreciate your continued support.',
													isCorrect: true,
												},
												{ key: 'C', content: 'The store opens at 9 a.m. daily.', isCorrect: false },
												{
													key: 'D',
													content: 'Please visit our website for more details.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						{
							id: 's562',
							examId: '5',
							order: 2,
							contentType: SectionType.Question,
							questions: {
								create: [
									{
										order: 120,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'launch', isCorrect: true },
												{ key: 'B', content: 'launches', isCorrect: false },
												{ key: 'C', content: 'launched', isCorrect: false },
												{ key: 'D', content: 'launching', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 121,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'regular', isCorrect: false },
												{ key: 'B', content: 'regularly', isCorrect: true },
												{ key: 'C', content: 'regularity', isCorrect: false },
												{ key: 'D', content: 'regulate', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 122,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'about', isCorrect: false },
												{ key: 'B', content: 'for', isCorrect: false },
												{ key: 'C', content: 'with', isCorrect: true },
												{ key: 'D', content: 'from', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 123,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The workshop is free of charge.', isCorrect: false },
												{
													key: 'B',
													content: 'Spaces are limited, so register early.',
													isCorrect: true,
												},
												{ key: 'C', content: 'Refreshments will be provided.', isCorrect: false },
												{
													key: 'D',
													content: 'The venue is accessible by public transit.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
					],
				},
			},
		];
	}

	private part7(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			{
				id: 's57',
				order: 7,
				contentType: SectionType.Section,
				childSections: {
					create: [
						{
							id: 's571',
							examId: '5',
							order: 1,
							contentType: SectionType.Question,
							questions: {
								create: [
									{
										order: 124,
										content: 'What is the main purpose of the email?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To announce a new branch opening', isCorrect: false },
												{ key: 'B', content: 'To request additional staff', isCorrect: false },
												{ key: 'C', content: 'To propose a change in work hours', isCorrect: true },
												{ key: 'D', content: 'To report a scheduling conflict', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 125,
										content: 'What is suggested about the new schedule?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'It will increase operational costs.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'It has been tested in other branches.',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'It requires approval from headquarters.',
													isCorrect: false,
												},
												{ key: 'D', content: 'It will take effect immediately.', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 126,
										content: 'The word "piloted" in the email is closest in meaning to',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'flown', isCorrect: false },
												{ key: 'B', content: 'tested', isCorrect: true },
												{ key: 'C', content: 'guided', isCorrect: false },
												{ key: 'D', content: 'abandoned', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Synonym In Context']) },
									},
								],
							},
						},
						{
							id: 's572',
							examId: '5',
							order: 2,
							contentType: SectionType.Question,
							questions: {
								create: [
									{
										order: 127,
										content: 'What is the notice mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A discount on select merchandise', isCorrect: false },
												{
													key: 'B',
													content: 'A change in store operating hours',
													isCorrect: false,
												},
												{ key: 'C', content: 'A new recycling program', isCorrect: true },
												{ key: 'D', content: 'A staff training requirement', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Announcement Notice']),
										},
									},
									{
										order: 128,
										content: 'What are customers encouraged to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Bring their own bags', isCorrect: true },
												{ key: 'B', content: 'Sort items before arriving', isCorrect: false },
												{ key: 'C', content: 'Sign up for a membership', isCorrect: false },
												{ key: 'D', content: 'Volunteer for the program', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs([
												'Detail Information',
												'Announcement Notice',
											]),
										},
									},
									{
										order: 129,
										content: 'What is offered as an incentive?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Free products', isCorrect: false },
												{ key: 'B', content: 'A discount coupon', isCorrect: true },
												{ key: 'C', content: 'Priority parking', isCorrect: false },
												{ key: 'D', content: 'Extended return policy', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs([
												'Detail Information',
												'Announcement Notice',
											]),
										},
									},
								],
							},
						},
						{
							id: 's573',
							examId: '5',
							order: 3,
							contentType: SectionType.Question,
							questions: {
								create: [
									{
										order: 130,
										content: 'What type of position is being advertised?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Sales manager', isCorrect: false },
												{ key: 'B', content: 'Customer service representative', isCorrect: false },
												{ key: 'C', content: 'Software developer', isCorrect: true },
												{ key: 'D', content: 'Marketing director', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 131,
										content: 'What qualification is required for the job?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "A master's degree", isCorrect: false },
												{ key: 'B', content: 'Five years of experience', isCorrect: true },
												{ key: 'C', content: 'Knowledge of multiple languages', isCorrect: false },
												{ key: 'D', content: 'Project management certification', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs([
												'Detail Information',
												'Advertisement Article',
											]),
										},
									},
									{
										order: 132,
										content: 'What benefit does the company offer?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Company car', isCorrect: false },
												{ key: 'B', content: 'Flexible working hours', isCorrect: true },
												{ key: 'C', content: 'Relocation assistance', isCorrect: false },
												{ key: 'D', content: 'Annual bonus', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs([
												'Detail Information',
												'Advertisement Article',
											]),
										},
									},
								],
							},
						},
					],
				},
			},
		];
	}
}
