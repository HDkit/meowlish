import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma, PrismaClient } from '@prisma-client/exam';

// TOEIC Reading Parts 5-7 only (32 questions, numbered 101-132 as in a real test). There is no
// Listening part and no audio, so the exam is labelled and timed as a Reading test.
const TITLE = 'TOEIC Reading 2 (Part 5–7)';
const TAGS = ['TOEIC Reading'];
// TOEIC Reading allows 75 minutes for 100 questions; 32 questions get 25 minutes.
const DURATION_SECONDS = 25 * 60;

const passage = (html: string) =>
	`<div class="context-wrapper"><div class="context-content text-highlightable"><div>${html}</div></div></div>`;

const PART5_DIRECTIVE = `<div><p><strong>Part 5</strong></p><p><em>A word or phrase is missing in each of the sentences below. Four answer choices are given below each sentence. Select the best answer to complete the sentence.</em></p></div>`;
const PART6_DIRECTIVE = `<div><p><strong>Part 6</strong></p><p><em>Read the texts that follow. A word, phrase, or sentence is missing in parts of each text. Four answer choices for each question are given below the text. Select the best answer to complete the text.</em></p></div>`;
const PART7_DIRECTIVE = `<div><p><strong>Part 7</strong></p><p><em>In this part you will read a selection of texts, such as emails, notices and advertisements. Each text is followed by several questions. Select the best answer for each question.</em></p></div>`;

const PART6_TEXT_1 =
	passage(`<p><strong>Questions 116-119</strong> refer to the following letter.</p>
<p>Dear Valued Customers,</p>
<p>We are writing to let you know about an update to our return policy. The 30-day return period has not changed, and you can still exchange items at any of our stores. The new policy ____116____ effective from June 1. ____117____, refunds will now be issued only to the original method of payment. This change was ____118____ by our customer service team after reviewing your feedback over the past year.</p>
<p>____119____</p>
<p>Sincerely,<br/>Martin Hale<br/>Store Manager, Brightway Home Goods</p>`);

const PART6_TEXT_2 =
	passage(`<p><strong>Questions 120-123</strong> refer to the following announcement.</p>
<p>Greenfield Business Center will ____120____ a series of free marketing workshops next month. The sessions, whose content is ____121____ updated to reflect the latest trends, are designed for owners of small businesses. They are offered in partnership ____122____ the Greenfield Chamber of Commerce. Each workshop takes place on a Thursday evening from 6 to 8 p.m. ____123____ To reserve a seat, visit www.greenfieldbc.com/workshops by May 20.</p>`);

const PART7_EMAIL = passage(`<p><strong>Questions 124-126</strong> refer to the following email.</p>
<p><strong>To:</strong> All Downtown Branch Staff<br/><strong>From:</strong> Elena Park, Operations Manager<br/><strong>Subject:</strong> Proposed schedule change</p>
<p>Dear team,</p>
<p>Starting next quarter, I would like to move our opening hours from 9:00 a.m.–5:00 p.m. to 8:00 a.m.–4:00 p.m. Many of our clients have asked to meet before their own workday begins, and an earlier start would let us serve them better.</p>
<p>This schedule was piloted at our Riverside and Northgate branches over the last three months. Both branches reported higher client satisfaction and no increase in costs.</p>
<p>Before I submit the proposal, I would like to hear your views. Please reply to this email by Friday with any concerns.</p>
<p>Best regards,<br/>Elena Park</p>`);

const PART7_NOTICE =
	passage(`<p><strong>Questions 127-129</strong> refer to the following notice.</p>
<p><strong>Fresh Market: Our New Recycling Program</strong></p>
<p>Beginning April 1, Fresh Market will collect glass, plastic and paper at the recycling station next to our main entrance. To reduce waste further, we encourage all customers to bring their own bags when they shop.</p>
<p>As a thank-you, every customer who drops off recyclable items will receive a coupon for 10% off their next purchase. Coupons are available at the customer service desk.</p>`);

const PART7_JOB_AD =
	passage(`<p><strong>Questions 130-132</strong> refer to the following advertisement.</p>
<p><strong>Software Developer – Bluewave Technologies</strong></p>
<p>Bluewave Technologies is looking for a software developer to join its product team in Singapore. The successful candidate will design and maintain the web applications used by our clients.</p>
<p><strong>Requirements:</strong> at least five years of experience in software development and strong communication skills. A degree in computer science is preferred but not required.</p>
<p><strong>We offer:</strong> a competitive salary, flexible working hours and opportunities for professional training.</p>
<p>To apply, send your résumé to careers@bluewave.example by June 30.</p>`);

/** Section directives by id; also applied to databases seeded before they existed. */
const DIRECTIVES: Record<string, string> = {
	s55: PART5_DIRECTIVE,
	s56: PART6_DIRECTIVE,
	s57: PART7_DIRECTIVE,
	s561: PART6_TEXT_1,
	s562: PART6_TEXT_2,
	s571: PART7_EMAIL,
	s572: PART7_NOTICE,
	s573: PART7_JOB_AD,
};

export class ToeicLr2ExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		return {
			id: '5',
			createdBy: 'admin',
			title: TITLE,
			duration: DURATION_SECONDS,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(TAGS),
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
				directive: DIRECTIVES.s55,
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
				directive: DIRECTIVES.s56,
				order: 6,
				contentType: SectionType.Section,
				childSections: {
					create: [
						{
							id: 's561',
							directive: DIRECTIVES.s561,
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
							directive: DIRECTIVES.s562,
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
				directive: DIRECTIVES.s57,
				order: 7,
				contentType: SectionType.Section,
				childSections: {
					create: [
						{
							id: 's571',
							directive: DIRECTIVES.s571,
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
							directive: DIRECTIVES.s572,
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
							directive: DIRECTIVES.s573,
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

/**
 * The exam seed skips exams that already exist, so databases seeded before this fix keep the old
 * "TOEIC LR 2": labelled Listening + Reading for 2 hours, with no Part 6/7 passages. Bring an
 * existing exam 5 up to date in place (attempts keep pointing at the same sections and questions).
 */
export async function refreshToeicLr2(
	prisma: PrismaClient,
	tagNamesToIdInputs: (names: string[]) => { tagId: string }[],
): Promise<void> {
	const exam = await prisma.exam.findUnique({ where: { id: '5' }, select: { id: true } });
	if (!exam) return;
	await prisma.$transaction([
		prisma.exam.update({ where: { id: '5' }, data: { title: TITLE, duration: DURATION_SECONDS } }),
		prisma.examTag.deleteMany({ where: { examId: '5' } }),
		prisma.examTag.createMany({
			data: tagNamesToIdInputs(TAGS).map(t => ({ examId: '5', tagId: t.tagId })),
			skipDuplicates: true,
		}),
		...Object.entries(DIRECTIVES).map(([id, directive]) =>
			prisma.section.updateMany({ where: { id: id, examId: '5' }, data: { directive: directive } }),
		),
	]);
}
