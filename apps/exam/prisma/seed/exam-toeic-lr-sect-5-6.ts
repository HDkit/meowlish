import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class ToeicLrExamSect56Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PART 5 — Incomplete Sentences (Q101–130)
			// Grammar tag per question based on the tested point
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's15',
				order: 5,
				contentType: SectionType.Question,
				questions: {
					create: [
						{
							order: 101,
							content:
								'------- the difference between the two brands is small, most consumers purchase the cheaper one.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'Until', isCorrect: false },
									{ key: 'B', content: 'Because', isCorrect: true },
									{ key: 'C', content: 'Before', isCorrect: false },
									{ key: 'D', content: 'So', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 102,
							content:
								'Audience members were impressed that the question asked of the candidate was answered -------.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'clearly', isCorrect: true },
									{ key: 'B', content: 'clear', isCorrect: false },
									{ key: 'C', content: 'cleared', isCorrect: false },
									{ key: 'D', content: 'clearing', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 103,
							content:
								'In an attempt ------- sustainable energy, city officials have had solar panels affixed to some public buildings.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'generates', isCorrect: false },
									{ key: 'B', content: 'generated', isCorrect: false },
									{ key: 'C', content: 'generating', isCorrect: false },
									{ key: 'D', content: 'to generate', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Infinitives Gerunds']) },
						},
						{
							order: 104,
							content:
								'The slow ------- of the fire department resulted in severe damage to the building.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'duration', isCorrect: false },
									{ key: 'B', content: 'response', isCorrect: true },
									{ key: 'C', content: 'treatment', isCorrect: false },
									{ key: 'D', content: 'maintenance', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 105,
							content:
								'After hours of searching, the source of the water leak was ------- identified by the plumber.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'routinely', isCorrect: false },
									{ key: 'B', content: 'finally', isCorrect: true },
									{ key: 'C', content: 'rarely', isCorrect: false },
									{ key: 'D', content: 'strongly', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 106,
							content:
								'Please tell ------- that the workshop has been moved to Conference Room 402.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'whatever', isCorrect: false },
									{ key: 'B', content: 'themselves', isCorrect: false },
									{ key: 'C', content: 'everyone', isCorrect: true },
									{ key: 'D', content: 'something', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 107,
							content:
								'Highway 16 was widened over the summer to ------- the heavier traffic that is using the roadway.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'duplicate', isCorrect: false },
									{ key: 'B', content: 'extend', isCorrect: false },
									{ key: 'C', content: 'accommodate', isCorrect: true },
									{ key: 'D', content: 'propose', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 108,
							content:
								'Meal vouchers were given to Beta Airways passengers ------- were not able to depart on time because of a booking error.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'when', isCorrect: false },
									{ key: 'B', content: 'because', isCorrect: false },
									{ key: 'C', content: 'recently', isCorrect: false },
									{ key: 'D', content: 'who', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Relative Clauses']) },
						},
						{
							order: 109,
							content:
								'The catalog for the gallery contains an accurate ------- of each piece of artwork that is offered for sale.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'described', isCorrect: false },
									{ key: 'B', content: 'description', isCorrect: true },
									{ key: 'C', content: 'descriptive', isCorrect: false },
									{ key: 'D', content: 'describes', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 110,
							content:
								'To ensure that old appliances are disposed of properly, the city will offer free removal of these devices ------- April 2 and April 5.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'into', isCorrect: false },
									{ key: 'B', content: 'from', isCorrect: false },
									{ key: 'C', content: 'until', isCorrect: false },
									{ key: 'D', content: 'between', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 111,
							content:
								'A buffet dinner is available to the guests, so they may eat ------- looks appetizing to them without having to place an order.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'anyway', isCorrect: false },
									{ key: 'B', content: 'whatever', isCorrect: true },
									{ key: 'C', content: 'wherever', isCorrect: false },
									{ key: 'D', content: 'anything', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 112,
							content:
								'During the music festival, goods will be sold only by ------- vendors who have registered with the planners.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'controversial', isCorrect: false },
									{ key: 'B', content: 'increased', isCorrect: false },
									{ key: 'C', content: 'confident', isCorrect: false },
									{ key: 'D', content: 'approved', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Participles']) },
						},
						{
							order: 113,
							content:
								'The grocery store chain Refresh Foods has ------- in organic products since it opened in 2001.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'participated', isCorrect: false },
									{ key: 'B', content: 'certified', isCorrect: false },
									{ key: 'C', content: 'specialized', isCorrect: true },
									{ key: 'D', content: 'admired', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 114,
							content:
								'The malfunction of the printer was ------- a component that had been inserted incorrectly during the assembly process.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'due to', isCorrect: true },
									{ key: 'B', content: 'whereas', isCorrect: false },
									{ key: 'C', content: 'as though', isCorrect: false },
									{ key: 'D', content: 'instead of', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 115,
							content:
								'The proposed holiday schedule is ------- to most workers because they feel it is fair.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'acceptably', isCorrect: false },
									{ key: 'B', content: 'accept', isCorrect: false },
									{ key: 'C', content: 'acceptable', isCorrect: true },
									{ key: 'D', content: 'accepting', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 116,
							content: 'The test will ------- prove whether or not the patient has the disease.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'like', isCorrect: false },
									{ key: 'B', content: 'liking', isCorrect: false },
									{ key: 'C', content: 'likable', isCorrect: false },
									{ key: 'D', content: 'likely', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 117,
							content:
								'With over two hundred unique stores, the Plainview Mall ------- millions of shoppers on an annual basis.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'attracts', isCorrect: true },
									{ key: 'B', content: 'implements', isCorrect: false },
									{ key: 'C', content: 'postpones', isCorrect: false },
									{ key: 'D', content: 'contributes', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 118,
							content:
								'The participants will be judged on ------- performance, and the winners will be announced later in the awards ceremony.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'athletically', isCorrect: false },
									{ key: 'B', content: 'athletic', isCorrect: true },
									{ key: 'C', content: 'athletes', isCorrect: false },
									{ key: 'D', content: 'athlete', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 119,
							content:
								'The York Foundation is an organization that has been supporting ------- in medical technology for the past decade.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'to advance', isCorrect: false },
									{ key: 'B', content: 'advanced', isCorrect: false },
									{ key: 'C', content: 'advances', isCorrect: true },
									{ key: 'D', content: 'advancing', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 120,
							content:
								'------- the volleyball tournament is held indoors or outdoors depends heavily on the weather forecast for that day.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'Because', isCorrect: false },
									{ key: 'B', content: 'Although', isCorrect: false },
									{ key: 'C', content: 'Whether', isCorrect: true },
									{ key: 'D', content: 'Whereas', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 121,
							content:
								'The company was under investigation after several former employees made allegations of unfair -------.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'compositions', isCorrect: false },
									{ key: 'B', content: 'assurances', isCorrect: false },
									{ key: 'C', content: 'momentums', isCorrect: false },
									{ key: 'D', content: 'practices', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
						},
						{
							order: 122,
							content:
								"------- joined Vince's Gym, Mr. Pinter could attend group classes and health counseling sessions for free.",
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'Being', isCorrect: false },
									{ key: 'B', content: 'Having', isCorrect: true },
									{ key: 'C', content: 'To have', isCorrect: false },
									{ key: 'D', content: 'To be', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Infinitives Gerunds']) },
						},
						{
							order: 123,
							content:
								'The best method for improving the ------- of your home at little cost is giving the exterior a fresh coat of paint.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'privacy', isCorrect: false },
									{ key: 'B', content: 'appearance', isCorrect: true },
									{ key: 'C', content: 'control', isCorrect: false },
									{ key: 'D', content: 'location', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
						{
							order: 124,
							content:
								'Marketers believed that if the packaging were more ------- colored, consumers might pay more attention to the product.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'variously', isCorrect: true },
									{ key: 'B', content: 'vary', isCorrect: false },
									{ key: 'C', content: 'various', isCorrect: false },
									{ key: 'D', content: 'variety', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 125,
							content:
								'The police officer directed the traffic ------- the detour ramp so that drivers could find the route easily.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'toward', isCorrect: true },
									{ key: 'B', content: 'like', isCorrect: false },
									{ key: 'C', content: 'of', isCorrect: false },
									{ key: 'D', content: 'during', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 126,
							content:
								'Employees are asked to pair up with another ------- and check each other at the predetermined meeting place during fire drills.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'reliance', isCorrect: false },
									{ key: 'B', content: 'supervision', isCorrect: false },
									{ key: 'C', content: 'colleague', isCorrect: true },
									{ key: 'D', content: 'calculator', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Personnel HR']) },
						},
						{
							order: 127,
							content:
								"The car owner submitted ------- evidence of the damage along with a mechanic's report to his insurance company.",
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'photographer', isCorrect: false },
									{ key: 'B', content: 'photographically', isCorrect: false },
									{ key: 'C', content: 'photographic', isCorrect: true },
									{ key: 'D', content: 'photogenic', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 128,
							content:
								'The restrooms on the second floor are ------- unavailable because one of the sinks is being replaced.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'temporarily', isCorrect: true },
									{ key: 'B', content: 'previously', isCorrect: false },
									{ key: 'C', content: 'respectively', isCorrect: false },
									{ key: 'D', content: 'vitally', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
						},
						{
							order: 129,
							content:
								'Because our sales representatives meet with high-level clients in the industry, ------- those with a professional manner will be considered for the position.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'only', isCorrect: true },
									{ key: 'B', content: 'moreover', isCorrect: false },
									{ key: 'C', content: 'except', isCorrect: false },
									{ key: 'D', content: 'however', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
						},
						{
							order: 130,
							content:
								"On next week's radio program, our host will interview Kristen Dabney about her time working as an ------- for a UN official.",
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'interpretation', isCorrect: false },
									{ key: 'B', content: 'interpret', isCorrect: false },
									{ key: 'C', content: 'interpreting', isCorrect: false },
									{ key: 'D', content: 'interpreter', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
						},
					],
				},
			},

			// ─────────────────────────────────────────────────────────────────
			// PART 6 — Text Completion (Q131–146)
			// All questions tagged Text Completion; passage image on first Q
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's16',
				order: 6,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Q131–134
						{
							id: 's161',
							examId: '1',
							order: 1,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_131-134.jpg' }] },
							questions: {
								create: [
									{
										order: 131,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'is requesting', isCorrect: false },
												{ key: 'B', content: 'has requested', isCorrect: false },
												{ key: 'C', content: 'have to request', isCorrect: true },
												{ key: 'D', content: 'had to request', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 132,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Unfortunately', isCorrect: false },
												{ key: 'B', content: 'Therefore', isCorrect: true },
												{ key: 'C', content: 'Regardless', isCorrect: false },
												{ key: 'D', content: 'Finally', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 133,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'upon', isCorrect: false },
												{ key: 'B', content: 'during', isCorrect: true },
												{ key: 'C', content: 'before', isCorrect: false },
												{ key: 'D', content: 'at', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 134,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content:
														'The move from keys to keyless entry should make the facility more secure.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'We will be looking forward to seeing you sometime next week.',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'The security office is open 24 hours a day.',
													isCorrect: true,
												},
												{ key: 'D', content: 'This is for product security.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						// Q135–138
						{
							id: 's162',
							examId: '1',
							order: 2,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_135-138.jpg' }] },
							questions: {
								create: [
									{
										order: 135,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'active', isCorrect: false },
												{ key: 'B', content: 'actived', isCorrect: false },
												{ key: 'C', content: 'actively', isCorrect: true },
												{ key: 'D', content: 'activated', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 136,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Our company tries to work with outside communities.',
													isCorrect: false,
												},
												{
													key: 'B',
													content:
														'Our commitment to the community is as important as our commitment to our students.',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'Our company is unique and uses strange instruments.',
													isCorrect: false,
												},
												{
													key: 'D',
													content:
														'Our company is in a special location, next to the auto service center.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 137,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'contemporary', isCorrect: true },
												{ key: 'B', content: 'unknown', isCorrect: false },
												{ key: 'C', content: 'strange', isCorrect: false },
												{ key: 'D', content: 'boring', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 138,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'apply', isCorrect: false },
												{ key: 'B', content: 'applied', isCorrect: false },
												{ key: 'C', content: 'applying', isCorrect: true },
												{ key: 'D', content: 'to apply', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						// Q139–142
						{
							id: 's163',
							examId: '1',
							order: 3,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_139-142.jpg' }] },
							questions: {
								create: [
									{
										order: 139,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'offers', isCorrect: true },
												{ key: 'B', content: 'sustains', isCorrect: false },
												{ key: 'C', content: 'mitigates', isCorrect: false },
												{ key: 'D', content: 'maintains', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 140,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'to approve', isCorrect: false },
												{ key: 'B', content: 'approves', isCorrect: false },
												{ key: 'C', content: 'approving', isCorrect: false },
												{ key: 'D', content: 'approved', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 141,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'So you can feel comfortable taking it night after night.',
													isCorrect: true,
												},
												{
													key: 'B',
													content: "Talk to your doctor today to see if it's right for you.",
													isCorrect: false,
												},
												{
													key: 'C',
													content:
														'This is the only stimulant approved for prolonged use that is approved by the FDA.',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'Enter this code for a free sample and discounts.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 142,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'during', isCorrect: false },
												{ key: 'B', content: 'around', isCorrect: false },
												{ key: 'C', content: 'before', isCorrect: true },
												{ key: 'D', content: 'after', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						// Q143–146
						{
							id: 's164',
							examId: '1',
							order: 4,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_143-146.jpg' }] },
							questions: {
								create: [
									{
										order: 143,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'make', isCorrect: false },
												{ key: 'B', content: 'plan', isCorrect: true },
												{ key: 'C', content: 'conceive', isCorrect: false },
												{ key: 'D', content: 'deliver', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 144,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'comments', isCorrect: false },
												{ key: 'B', content: 'suggestions', isCorrect: true },
												{ key: 'C', content: 'spots', isCorrect: false },
												{ key: 'D', content: 'suggested', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 145,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'is a safe space for all customs and cultures',
													isCorrect: true,
												},
												{ key: 'B', content: 'stays open late on Tuesday', isCorrect: false },
												{ key: 'C', content: 'needs a new janitor', isCorrect: false },
												{ key: 'D', content: 'will move next week', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 146,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'I look forward to your ideas and enthusiasm.',
													isCorrect: true,
												},
												{
													key: 'B',
													content: "I'm look forward to your ideas and enthusiasm.",
													isCorrect: false,
												},
												{
													key: 'C',
													content: "I look forward to you're undivided attention.",
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'I hope you reply before its too late.',
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
}
