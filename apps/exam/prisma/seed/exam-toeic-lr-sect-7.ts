import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class ToeicLrExamSect7Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			{
				id: 's17',
				order: 7,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// ── Group 1: Q147–148 — Flyer (TriStar Sports Gear summer sale)
						{
							id: 's171',
							examId: '1',
							order: 1,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_147-148.jpg' }] },
							questions: {
								create: [
									{
										order: 147,
										content: 'What is being advertised?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'A seasonal sale at a sporting goods store',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'The opening of a new sports stadium',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'A summer sports camp for students',
													isCorrect: false,
												},
												{ key: 'D', content: 'A new line of team jerseys', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 148,
										content: 'How can customers receive a discount on balls?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'By buying two pairs of athletic shoes',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'By bringing the flyer to the store',
													isCorrect: true,
												},
												{ key: 'C', content: 'By ordering from the Web site', isCorrect: false },
												{ key: 'D', content: 'By shopping before Friday', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 2: Q149–150 — Text message chain (choosing a movie)
						{
							id: 's172',
							examId: '1',
							order: 2,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_149-150.jpg' }] },
							questions: {
								create: [
									{
										order: 149,
										content: 'What are the writers mainly discussing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Where to have dinner', isCorrect: false },
												{ key: 'B', content: 'Which movie to see', isCorrect: true },
												{ key: 'C', content: 'How to get to the theater', isCorrect: false },
												{ key: 'D', content: 'Who will buy the tickets', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Text Message Chain']),
										},
									},
									{
										order: 150,
										content: 'At 19:25, what does Jason most likely mean when he writes, "Im in"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He has arrived at the theater', isCorrect: false },
												{ key: 'B', content: 'He agrees to see the comedy', isCorrect: true },
												{
													key: 'C',
													content: 'He still prefers the horror movie',
													isCorrect: false,
												},
												{ key: 'D', content: 'He has already bought a ticket', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 3: Q151–152 — Article (Brixton Science Journal, archeology presentation)
						{
							id: 's173',
							examId: '1',
							order: 3,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_151-152.jpg' }] },
							questions: {
								create: [
									{
										order: 151,
										content: 'What is the article mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'The opening of a new public library',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'An upcoming presentation by an archeologist',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'A farming course offered in Egypt',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'The sale of ancient Egyptian tools',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 152,
										content: 'Why are attendees encouraged to arrive early?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To get a seat near the stage', isCorrect: false },
												{ key: 'B', content: 'To meet Mr. Price in person', isCorrect: false },
												{ key: 'C', content: 'To view ancient items on display', isCorrect: true },
												{ key: 'D', content: 'To register for an expedition', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 4: Q153–154 — Notice (Spring Valley Center grand opening)
						{
							id: 's174',
							examId: '1',
							order: 4,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_153-154.jpg' }] },
							questions: {
								create: [
									{
										order: 153,
										content: 'What is the purpose of the notice?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To announce the construction of a highway',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'To invite people to tour office spaces for rent',
													isCorrect: true,
												},
												{ key: 'C', content: 'To advertise apartments for sale', isCorrect: false },
												{
													key: 'D',
													content: 'To announce that a company is relocating',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Announcement Notice']),
										},
									},
									{
										order: 154,
										content: 'What is indicated about Spring Valley Center?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It is open only on weekends', isCorrect: false },
												{
													key: 'B',
													content: 'Tours must be reserved in advance',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'It is easy to reach from a highway',
													isCorrect: true,
												},
												{ key: 'D', content: 'It is located in Oregon', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 5: Q155–157 — Article (Lockland Business News, new Cashco warehouse)
						{
							id: 's175',
							examId: '1',
							order: 5,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_155-157.jpg' }] },
							questions: {
								create: [
									{
										order: 155,
										content: 'What is the article mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Long waits at the Canadian border',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'A new Cashco warehouse coming to Lockland',
													isCorrect: true,
												},
												{ key: 'C', content: 'The closing of a Canadian Cashco', isCorrect: false },
												{ key: 'D', content: 'A petition against a new store', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 156,
										content: 'What is NOT mentioned as a feature of the new Lockland Cashco?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A pet center', isCorrect: false },
												{ key: 'B', content: 'A medical clinic', isCorrect: false },
												{ key: 'C', content: 'A bakery', isCorrect: true },
												{ key: 'D', content: 'A garden center', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Exception NOT true']) },
									},
									{
										order: 157,
										content:
											'In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? "Cashco has announced that it will open a warehouse in Lockland."',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: '[1]', isCorrect: true },
												{ key: 'B', content: '[2]', isCorrect: false },
												{ key: 'C', content: '[3]', isCorrect: false },
												{ key: 'D', content: '[4]', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						// ── Group 6: Q158–160 — Article (Centerville County Shelter charity walking marathon)
						{
							id: 's176',
							examId: '1',
							order: 6,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_158-160.jpg' }] },
							questions: {
								create: [
									{
										order: 158,
										content: 'What is the purpose of the article?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To announce a fundraising event', isCorrect: true },
												{
													key: 'B',
													content: 'To report on the history of a shelter',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'To recruit volunteers for a shelter',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To announce the results of a race',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 159,
										content: 'What is indicated about the marathon?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'It will be held for the first time',
													isCorrect: false,
												},
												{ key: 'B', content: 'It has been held once before', isCorrect: true },
												{ key: 'C', content: 'It is open only to adults', isCorrect: false },
												{ key: 'D', content: 'It is a running race', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 160,
										content: 'What is stated about children who participate?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'They must be accompanied by an adult family member',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'They must pay a reduced entry fee',
													isCorrect: false,
												},
												{ key: 'C', content: 'They will walk a shorter route', isCorrect: false },
												{ key: 'D', content: 'They must register in advance', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 7: Q161–164 — Online chat discussion (victory parade)
						{
							id: 's177',
							examId: '1',
							order: 7,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_161-164.jpg' }] },
							questions: {
								create: [
									{
										order: 161,
										content: 'What are the writers mainly discussing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Attending a victory parade', isCorrect: true },
												{ key: 'B', content: 'Signing a sponsorship contract', isCorrect: false },
												{ key: 'C', content: 'Planning a university event', isCorrect: false },
												{ key: 'D', content: 'Hiring a new quarterback', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Text Message Chain']),
										},
									},
									{
										order: 162,
										content: 'What kind of business do the writers most likely work for?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A university', isCorrect: false },
												{ key: 'B', content: 'A sports stadium', isCorrect: false },
												{ key: 'C', content: 'A beer company', isCorrect: true },
												{ key: 'D', content: 'A marketing agency', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 163,
										content: 'Why is Jeff concerned?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The parade may be canceled', isCorrect: false },
												{
													key: 'B',
													content: 'A competitor has contracts with the university and the stadium',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'He does not have a ticket to the game',
													isCorrect: false,
												},
												{ key: 'D', content: 'Their new product is not ready', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 164,
										content:
											'What does Susan most likely mean when she writes, "you better keep your mouth shut"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Jeff should stop complaining about the game',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'Jeff should not draw attention to their company at the event',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'Jeff should not share his notes with Molly',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'Jeff should not cheer during the parade',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 8: Q165–167 — Notice (Lichtenberg Air baggage fee increase)
						{
							id: 's178',
							examId: '1',
							order: 8,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_165-167.jpg' }] },
							questions: {
								create: [
									{
										order: 165,
										content: 'What is the purpose of the notice?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To announce an increase in baggage fees',
													isCorrect: true,
												},
												{ key: 'B', content: 'To introduce new flight routes', isCorrect: false },
												{
													key: 'C',
													content: 'To explain a new carry-on bag policy',
													isCorrect: false,
												},
												{ key: 'D', content: 'To apologize for flight delays', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Announcement Notice']),
										},
									},
									{
										order: 166,
										content: 'According to the notice, why is the change being made?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Passengers are carrying more bags',
													isCorrect: false,
												},
												{ key: 'B', content: 'Fuel costs are rising', isCorrect: true },
												{ key: 'C', content: 'Airport fees have increased', isCorrect: false },
												{ key: 'D', content: 'New aircraft have been purchased', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 167,
										content: 'What is indicated about Lichtenberg Air?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'It will start charging for carry-on bags',
													isCorrect: false,
												},
												{ key: 'B', content: 'It plans to lower ticket prices', isCorrect: false },
												{
													key: 'C',
													content: 'It has not raised its baggage fees in ten years',
													isCorrect: true,
												},
												{ key: 'D', content: 'It will stop flying on October 1', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 9: Q168–171 — Letter (Conference for Second Language Education speaker)
						{
							id: 's179',
							examId: '1',
							order: 9,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_168-171.jpg' }] },
							questions: {
								create: [
									{
										order: 168,
										content: 'Why was the letter written?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To offer Ms. Lynch a teaching position',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'To provide details to a conference speaker',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'To ask Ms. Lynch to register for a workshop',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To request payment for a conference',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 169,
										content: 'What is suggested about Ms. Lynch?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'She will travel to the conference by plane',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'She teaches German at a university',
													isCorrect: false,
												},
												{
													key: 'C',
													content: "She organized last year's conference",
													isCorrect: false,
												},
												{ key: 'D', content: 'She lives in Salem, Oregon', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 170,
										content: 'What is NOT offered to speakers?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The loan of a laptop', isCorrect: false },
												{
													key: 'B',
													content: 'Free admission to other workshops',
													isCorrect: false,
												},
												{ key: 'C', content: 'A ride from the airport', isCorrect: false },
												{ key: 'D', content: 'Free hotel accommodation', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Exception NOT true']) },
									},
									{
										order: 171,
										content: 'What is Ms. Lynch asked to do before April 10?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Send a copy of her presentation', isCorrect: false },
												{
													key: 'B',
													content: 'Call the office with her travel itinerary',
													isCorrect: true,
												},
												{ key: 'C', content: 'Return any borrowed equipment', isCorrect: false },
												{ key: 'D', content: 'Reserve a rental car', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// ── Group 10: Q172–175 — Letter (Bandit Pharmaceuticals, new employee relocation)
						{
							id: 's17_10',
							examId: '1',
							order: 10,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_172-175.jpg' }] },
							questions: {
								create: [
									{
										order: 172,
										content: 'What is the purpose of the letter?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To offer Mr. Jean a job interview',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'To welcome a new employee and help with his move',
													isCorrect: true,
												},
												{ key: 'C', content: 'To confirm a hotel reservation', isCorrect: false },
												{ key: 'D', content: 'To announce a new safety policy', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 173,
										content: 'What will Mr. Jean do on May 5?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Arrive in Boston', isCorrect: false },
												{
													key: 'B',
													content: 'Check in to the Boston Family Inn',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'Attend an orientation for new hires',
													isCorrect: true,
												},
												{ key: 'D', content: 'Meet with a real estate agent', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 174,
										content: 'Who most likely is Ms. Rhimes?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'A front-desk clerk at the Boston Family Inn',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'A human resources employee who assists new staff',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'A research director at Bandit Pharmaceuticals',
													isCorrect: false,
												},
												{ key: 'D', content: 'A taxi driver in Boston', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 175,
										content:
											'In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? "Lunch will be provided for all participants in the company cafeteria."',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: '[1]', isCorrect: true },
												{ key: 'B', content: '[2]', isCorrect: false },
												{ key: 'C', content: '[3]', isCorrect: false },
												{ key: 'D', content: '[4]', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
						},
						// ── Group 11: Q176–180 — Double passage (Web page + E-mail, Blackrock German Language Scholarship)
						{
							id: 's17_11',
							examId: '1',
							order: 11,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_176-180.jpg' }, { fileId: 'SYSTEM_176-180_2.jpg' }],
							},
							questions: {
								create: [
									{
										order: 176,
										content: 'What is the main purpose of the Web page?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To announce a scholarship application period',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'To advertise German language classes',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'To introduce a new foundation director',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To report the results of a competition',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Announcement Notice']),
										},
									},
									{
										order: 177,
										content: 'What is NOT a requirement for scholarship applicants?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: "Being enrolled in a master's program",
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'Submitting a complete health check',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'Providing a recommendation from a former language instructor',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'Having previously studied in Germany',
													isCorrect: true,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Exception NOT true']) },
									},
									{
										order: 178,
										content: 'According to the Web page, what must scholarship recipients do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Teach a German class', isCorrect: false },
												{ key: 'B', content: 'Maintain a B+ grade average', isCorrect: true },
												{ key: 'C', content: 'Submit weekly progress reports', isCorrect: false },
												{ key: 'D', content: 'Work part-time at the foundation', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 179,
										content: 'What is suggested about Mr. Porter?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: "He is currently enrolled in a master's program",
													isCorrect: true,
												},
												{ key: 'B', content: 'He works as a German instructor', isCorrect: false },
												{
													key: 'C',
													content: 'He submitted his application in April',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'He has lived in Germany for a year',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 180,
										content: 'What does Mr. Richter say he will send within the next week?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'An application form', isCorrect: false },
												{
													key: 'B',
													content: 'A booklet on scholarship regulations',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'Specific details on preparing for his studies',
													isCorrect: true,
												},
												{ key: 'D', content: 'A check for travel expenses', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 12: Q181–185 — Double passage (Invoice + Letter, Sunny Day Cleaning billing)
						{
							id: 's17_12',
							examId: '1',
							order: 12,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_181-185.jpg' }, { fileId: 'SYSTEM_181-185_2.jpg' }],
							},
							questions: {
								create: [
									{
										order: 181,
										content: 'What is the invoice for?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Office cleaning services', isCorrect: true },
												{ key: 'B', content: 'Auto body repairs', isCorrect: false },
												{ key: 'C', content: 'Carpet installation', isCorrect: false },
												{ key: 'D', content: 'Furniture delivery', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Form Schedule List']),
										},
									},
									{
										order: 182,
										content:
											'According to the invoice, what will happen if payment is received after April 1?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The service will be canceled', isCorrect: false },
												{ key: 'B', content: 'A $20 late charge will be added', isCorrect: true },
												{ key: 'C', content: 'A $5 discount will be lost', isCorrect: false },
												{ key: 'D', content: 'A new invoice will be sent', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 183,
										content: 'Why did Ms. Collins write the letter?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To complain about the quality of the cleaning',
													isCorrect: false,
												},
												{ key: 'B', content: 'To cancel a cleaning contract', isCorrect: false },
												{ key: 'C', content: 'To ask for a corrected bill', isCorrect: true },
												{
													key: 'D',
													content: 'To schedule an additional cleaning',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 184,
										content: 'Who most likely is Rod Sanford?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A manager at Randall Auto Body', isCorrect: false },
												{ key: 'B', content: 'An employee of Sunny Day Cleaning', isCorrect: true },
												{ key: 'C', content: 'A customer at another location', isCorrect: false },
												{
													key: 'D',
													content: 'An accountant hired by Ms. Collins',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 185,
										content: 'What should the total on the corrected invoice most likely be?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: '$170', isCorrect: false },
												{ key: 'B', content: '$180', isCorrect: true },
												{ key: 'C', content: '$185', isCorrect: false },
												{ key: 'D', content: '$190', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 13: Q186–190 — Triple passage (Article + Web page + Award, Freewheel ride-sharing app)
						{
							id: 's17_13',
							examId: '1',
							order: 13,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [
									{ fileId: 'SYSTEM_186-190.jpg' },
									{ fileId: 'SYSTEM_186-190_2.jpg' },
									{ fileId: 'SYSTEM_186-190_3.jpg' },
								],
							},
							questions: {
								create: [
									{
										order: 186,
										content: 'What is the article mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Rising bus and taxi fares', isCorrect: false },
												{
													key: 'B',
													content: 'The growing popularity of a ride-sharing app',
													isCorrect: true,
												},
												{ key: 'C', content: 'A new subway line in Sherwood', isCorrect: false },
												{ key: 'D', content: 'A small business in Brentwood', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 187,
										content: 'What is indicated about Jordan Mills?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He owns a small business', isCorrect: true },
												{ key: 'B', content: 'He works as a Freewheel driver', isCorrect: false },
												{ key: 'C', content: 'He lives in Sherwood', isCorrect: false },
												{ key: 'D', content: 'He drives to work every day', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 188,
										content: 'In the article title, the word "Respite" is closest in meaning to',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'delay', isCorrect: false },
												{ key: 'B', content: 'relief', isCorrect: true },
												{ key: 'C', content: 'payment', isCorrect: false },
												{ key: 'D', content: 'challenge', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Synonym In Context']) },
									},
									{
										order: 189,
										content: 'According to the Web page, how did Freewheel begin?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'As a taxi company in Brentwood', isCorrect: false },
												{
													key: 'B',
													content: 'As a car pooling program at a workplace',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'As a project at a technology conference',
													isCorrect: false,
												},
												{ key: 'D', content: 'As a bus route planning service', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 190,
										content: 'Why did Mr. Owens receive the award?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'For founding Technology Initiatives',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'For his novel use of technology in transportation',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'For reducing the cost of subway fares',
													isCorrect: false,
												},
												{ key: 'D', content: 'For hiring 500 new drivers', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 14: Q191–195 — Triple passage (three E-mails, Action Services shipping contract)
						{
							id: 's17_14',
							examId: '1',
							order: 14,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [
									{ fileId: 'SYSTEM_191-195.jpg' },
									{ fileId: 'SYSTEM_191-195_2.jpg' },
									{ fileId: 'SYSTEM_191-195_3.jpg' },
								],
							},
							questions: {
								create: [
									{
										order: 191,
										content: 'Why did Ms. Pierce write the first e-mail?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To complain about a late delivery',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'To ask whether a company can offer lower shipping rates',
													isCorrect: true,
												},
												{ key: 'C', content: 'To order flower arrangements', isCorrect: false },
												{
													key: 'D',
													content: 'To cancel a contract with Emergent Solutions',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 192,
										content: 'What does Action Services specialize in?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Shipping and delivery', isCorrect: false },
												{
													key: 'B',
													content: 'Personalized flower arrangements and gifts',
													isCorrect: true,
												},
												{ key: 'C', content: 'Environmental consulting', isCorrect: false },
												{ key: 'D', content: 'Hybrid vehicle sales', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 193,
										content: 'What is indicated about Express Corp.?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: "It is Action Services' current shipping company",
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'It was founded by college students',
													isCorrect: false,
												},
												{ key: 'C', content: 'It uses hybrid delivery vehicles', isCorrect: false },
												{
													key: 'D',
													content: 'It is owned by Emergent Solutions',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 194,
										content:
											'According to Mr. Alberts, what does Emergent Solutions use for small deliveries?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Bicycles', isCorrect: false },
												{ key: 'B', content: 'Rental trucks', isCorrect: false },
												{ key: 'C', content: 'Fuel-efficient hybrid vehicles', isCorrect: true },
												{ key: 'D', content: 'The postal service', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 195,
										content: 'Why is Ms. Pierce most likely pleased with Emergent Solutions?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Its office is close to City College',
													isCorrect: false,
												},
												{ key: 'B', content: 'It offers international shipping', isCorrect: false },
												{
													key: 'C',
													content: 'Its transportation is environmentally responsible',
													isCorrect: true,
												},
												{
													key: 'D',
													content: 'It has agreed to buy recyclable products',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 15: Q196–200 — Triple passage (two E-mails + Sales leads table, performance review)
						{
							id: 's17_15',
							examId: '1',
							order: 15,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [
									{ fileId: 'SYSTEM_196-200.jpg' },
									{ fileId: 'SYSTEM_196-200_2.jpg' },
									{ fileId: 'SYSTEM_196-200_3.jpg' },
								],
							},
							questions: {
								create: [
									{
										order: 196,
										content: 'What is the purpose of the first e-mail?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To give a coworker advance notice of a performance review',
													isCorrect: true,
												},
												{ key: 'B', content: 'To announce a promotion', isCorrect: false },
												{
													key: 'C',
													content: 'To invite a coworker to a training session',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To request sales figures from last year',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 197,
										content: 'What is suggested about the company?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It is opening a beauty parlor', isCorrect: false },
												{ key: 'B', content: 'It may reduce its staff', isCorrect: true },
												{ key: 'C', content: 'It has exceeded its sales goals', isCorrect: false },
												{ key: 'D', content: "It will hire Mr. Jones's sister", isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 198,
										content: 'What is indicated about Mr. Holt?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He has exceeded his sales targets', isCorrect: true },
												{ key: 'B', content: 'He works in the beauty industry', isCorrect: false },
												{ key: 'C', content: "He is Mr. Donald's supervisor", isCorrect: false },
												{ key: 'D', content: 'He plans to change industries', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 199,
										content: 'When will the results of the review most likely be released?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'In January', isCorrect: false },
												{ key: 'B', content: 'In February', isCorrect: false },
												{ key: 'C', content: 'In March', isCorrect: true },
												{ key: 'D', content: 'In April', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 200,
										content: 'Which sales lead has the highest account potential?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Sally Jones', isCorrect: false },
												{ key: 'B', content: 'Bob Knuddle', isCorrect: true },
												{ key: 'C', content: 'Marquise Lee', isCorrect: false },
												{ key: 'D', content: 'Mr. Jones', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
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
