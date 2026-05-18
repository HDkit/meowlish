import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class ToeicLrExamSect34Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PART 3 — Conversations (Q32–70)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's13',
				order: 3,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Q32–34
						{
							id: 's131',
							examId: '1',
							order: 1,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q32-34.mp3' }] },
							questions: {
								create: [
									{
										order: 32,
										content: 'How do the speakers know each other?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'They met through a friend.', isCorrect: false },
												{ key: 'B', content: 'They take a class together.', isCorrect: false },
												{
													key: 'C',
													content: 'They live in the same apartment complex.',
													isCorrect: false,
												},
												{ key: 'D', content: 'They work at the same company.', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 33,
										content: 'What does the woman suggest that the man do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Introduce himself to his co-workers',
													isCorrect: false,
												},
												{ key: 'B', content: 'Wear a work uniform', isCorrect: false },
												{ key: 'C', content: 'Learn how to make a list of goods', isCorrect: true },
												{ key: 'D', content: 'Have a house-warming party', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
									{
										order: 34,
										content: 'What does the man need to do first?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Change his clothes', isCorrect: true },
												{ key: 'B', content: 'Attach a name tag', isCorrect: false },
												{ key: 'C', content: 'Contact a warehouse supervisor', isCorrect: false },
												{ key: 'D', content: 'Read an employee handbook', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q35–37
						{
							id: 's132',
							examId: '1',
							order: 2,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q35-37.mp3' }] },
							questions: {
								create: [
									{
										order: 35,
										content: 'Why is the man calling?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He forgot a document password.', isCorrect: false },
												{ key: 'B', content: 'He needs an important document.', isCorrect: true },
												{ key: 'C', content: 'He wants to apply for a job.', isCorrect: false },
												{ key: 'D', content: 'His computer is not working.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Topic Purpose']) },
									},
									{
										order: 36,
										content: 'When will the woman leave work?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: '4:00 P.M.', isCorrect: false },
												{ key: 'B', content: '5:00 P.M.', isCorrect: false },
												{ key: 'C', content: '6:00 P.M.', isCorrect: false },
												{ key: 'D', content: '7:00 P.M.', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 37,
										content: 'What does the woman suggest the man do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Extend a warranty', isCorrect: false },
												{ key: 'B', content: 'Come to work early tomorrow', isCorrect: false },
												{ key: 'C', content: 'Participate in a survey', isCorrect: false },
												{ key: 'D', content: 'Check his e-mail', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q38–40
						{
							id: 's133',
							examId: '1',
							order: 3,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q38-40.mp3' }] },
							questions: {
								create: [
									{
										order: 38,
										content: 'Where does the woman work?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'At a restaurant', isCorrect: false },
												{ key: 'B', content: 'At a university', isCorrect: false },
												{ key: 'C', content: 'At a movie theater', isCorrect: false },
												{ key: 'D', content: 'At a hotel', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 39,
										content: 'Why are the tables and chairs currently unavailable?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A shipment has not arrived.', isCorrect: false },
												{
													key: 'B',
													content: "The woman didn't permit their use.",
													isCorrect: false,
												},
												{ key: 'C', content: 'Other people are using them.', isCorrect: true },
												{ key: 'D', content: 'The storage room is locked.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 40,
										content: 'What does the man clarify?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The expected number of guests', isCorrect: true },
												{ key: 'B', content: 'The location of stored supplies', isCorrect: false },
												{ key: 'C', content: 'The starting time of an event', isCorrect: false },
												{ key: 'D', content: 'The necessary documents', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q41–43
						{
							id: 's134',
							examId: '1',
							order: 4,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q41-43.mp3' }] },
							questions: {
								create: [
									{
										order: 41,
										content: 'What are the speakers mainly discussing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A new recipe', isCorrect: false },
												{ key: 'B', content: 'A grand opening', isCorrect: false },
												{ key: 'C', content: 'A magazine article', isCorrect: true },
												{ key: 'D', content: 'A detailed itinerary', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Topic Purpose']) },
									},
									{
										order: 42,
										content: 'What change does the woman mention about the restaurant?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A menu was expanded.', isCorrect: true },
												{ key: 'B', content: 'An address was changed.', isCorrect: false },
												{ key: 'C', content: 'A document was revised.', isCorrect: false },
												{ key: 'D', content: 'An opening date was delayed.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 43,
										content: 'What does the man suggest doing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Redecorating the space', isCorrect: false },
												{ key: 'B', content: 'Hiring a Mexican chef', isCorrect: false },
												{ key: 'C', content: 'Meeting at a different time', isCorrect: true },
												{ key: 'D', content: 'Making a reservation', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q44–46
						{
							id: 's135',
							examId: '1',
							order: 5,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q44-46.mp3' }] },
							questions: {
								create: [
									{
										order: 44,
										content: 'Where is the conversation taking place?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'At a theater', isCorrect: false },
												{ key: 'B', content: 'At a furniture store', isCorrect: false },
												{ key: 'C', content: 'At a pet store', isCorrect: true },
												{ key: 'D', content: 'At a restaurant', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 45,
										content: 'What problem does the man mention?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'A piece of equipment is out of order.',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'Some fish was not cooked properly.',
													isCorrect: false,
												},
												{ key: 'C', content: 'A personal item has been lost.', isCorrect: false },
												{ key: 'D', content: 'An extra charge was added.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 46,
										content: 'What does the woman say she will do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Deliver an item', isCorrect: false },
												{ key: 'B', content: 'Fix a computer error', isCorrect: false },
												{ key: 'C', content: 'Replace a purchase', isCorrect: true },
												{ key: 'D', content: 'Offer a discount', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q47–49
						{
							id: 's136',
							examId: '1',
							order: 6,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q47-49.mp3' }] },
							questions: {
								create: [
									{
										order: 47,
										content: 'Who most likely is the man?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A recording technician', isCorrect: false },
												{ key: 'B', content: 'A tour guide', isCorrect: false },
												{ key: 'C', content: 'A musician', isCorrect: false },
												{ key: 'D', content: 'A radio host', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 48,
										content: 'What kind of music does the woman currently play?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Pop', isCorrect: false },
												{ key: 'B', content: 'Rock', isCorrect: true },
												{ key: 'C', content: 'Folk', isCorrect: false },
												{ key: 'D', content: 'Blues', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 49,
										content:
											'According to the woman, what will be different about her upcoming performance?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It will begin at midnight.', isCorrect: false },
												{ key: 'B', content: 'It is free to the public.', isCorrect: false },
												{ key: 'C', content: 'It will be broadcast live.', isCorrect: false },
												{ key: 'D', content: 'It will include more performers.', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q50–52
						{
							id: 's137',
							examId: '1',
							order: 7,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q50-52.mp3' }] },
							questions: {
								create: [
									{
										order: 50,
										content: 'Who is Mr. Hyatt?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Building Manager', isCorrect: false },
												{ key: 'B', content: 'Fund Manager', isCorrect: true },
												{ key: 'C', content: 'Accountant', isCorrect: false },
												{ key: 'D', content: 'Construction worker', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 51,
										content: 'What problem does Mrs. Jasmin mention?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The main branch is closed.', isCorrect: false },
												{ key: 'B', content: 'Construction is continuing.', isCorrect: false },
												{ key: 'C', content: "She didn't receive some funds.", isCorrect: true },
												{ key: 'D', content: 'The timing was incorrect.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 52,
										content: 'What does Mr. Hyatt ask Mrs. Jasmin to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "Don't message him back", isCorrect: false },
												{ key: 'B', content: 'Send him a message back', isCorrect: true },
												{ key: 'C', content: 'Review the receipt', isCorrect: false },
												{ key: 'D', content: 'Cancel the transfer', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q53–55
						{
							id: 's138',
							examId: '1',
							order: 8,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q53-55.mp3' }] },
							questions: {
								create: [
									{
										order: 53,
										content: 'What does the woman say about the restaurant space?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "She thinks it's too big.", isCorrect: false },
												{ key: 'B', content: 'It has a good location.', isCorrect: true },
												{ key: 'C', content: 'The location is not good.', isCorrect: false },
												{ key: 'D', content: "It's a bit far from her office.", isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 54,
										content:
											'Why does the woman say "I\'ve looked at another location up the street that is about 10% cheaper"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To get a lower rental cost', isCorrect: true },
												{ key: 'B', content: 'To buy the property', isCorrect: false },
												{ key: 'C', content: 'To prepare a new contract', isCorrect: false },
												{ key: 'D', content: 'To deny the request', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Implication']) },
									},
									{
										order: 55,
										content: 'What does the man say about the price?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He agrees to reduce it.', isCorrect: false },
												{ key: 'B', content: 'He has to ask his co-worker.', isCorrect: false },
												{ key: 'C', content: 'He has to ask his manager.', isCorrect: true },
												{ key: 'D', content: 'He refuses to reduce it.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q56–58
						{
							id: 's139',
							examId: '1',
							order: 9,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q56-58.mp3' }] },
							questions: {
								create: [
									{
										order: 56,
										content: 'What are the speakers discussing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Sales results of last quarter', isCorrect: false },
												{ key: 'B', content: 'Sales results of last month', isCorrect: true },
												{ key: 'C', content: 'Sales of the new range', isCorrect: false },
												{ key: 'D', content: 'Sales for the coming month', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Topic Purpose']) },
									},
									{
										order: 57,
										content: 'What does the woman imply when she says "That\'s interesting"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'She wants to work at the Collingwood store.',
													isCorrect: false,
												},
												{ key: 'B', content: 'She knows the sales are down.', isCorrect: false },
												{ key: 'C', content: "She wasn't listening to the man.", isCorrect: false },
												{
													key: 'D',
													content: 'She wants to know why the sales are down.',
													isCorrect: true,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Implication']) },
									},
									{
										order: 58,
										content: 'What does the man suggest they do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Visit Head Office', isCorrect: false },
												{ key: 'B', content: 'Visit the Woodsdale store', isCorrect: false },
												{ key: 'C', content: 'Visit the Collingwood store', isCorrect: true },
												{ key: 'D', content: 'Visit their Manager', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q59–61
						{
							id: 's13_10',
							examId: '1',
							order: 10,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q59-61.mp3' }] },
							questions: {
								create: [
									{
										order: 59,
										content: 'Where most likely are the speakers?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'At an office', isCorrect: false },
												{ key: 'B', content: "At a lawyer's office", isCorrect: false },
												{ key: 'C', content: 'At a hardware store', isCorrect: true },
												{ key: 'D', content: 'At a local mall', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 60,
										content: 'What does the man mention about the delivery?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: "He isn't getting any equipment delivered to the office.",
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'He is getting the small equipment delivered to the office.',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'He is getting a drill delivered to the office.',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'He is getting some documents delivered to the office.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 61,
										content: 'What does the man say he needs?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A drill', isCorrect: false },
												{ key: 'B', content: 'Some hammers', isCorrect: false },
												{ key: 'C', content: 'A shovel', isCorrect: false },
												{ key: 'D', content: 'Some nails', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q62–64 (graphic)
						{
							id: 's13_11',
							examId: '1',
							order: 11,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q62-64.mp3' }, { fileId: 'SYSTEM_62-64.jpg' }],
							},
							questions: {
								create: [
									{
										order: 62,
										content: 'What did the man recently do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'He met with a photographer.', isCorrect: false },
												{ key: 'B', content: 'He met with a sales associate.', isCorrect: false },
												{
													key: 'C',
													content: 'He met with an interior decorator.',
													isCorrect: true,
												},
												{ key: 'D', content: 'He had lunch.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 63,
										content: 'Why does the man want to move the sales desk?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "To increase the company's sales", isCorrect: false },
												{ key: 'B', content: 'To make it look nicer', isCorrect: false },
												{
													key: 'C',
													content: 'To make more room for the woman to work',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To give waiting customers more space',
													isCorrect: true,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 64,
										content: 'Look at the graphic. Where will the sales desk be moved to?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Where the help desk is now.', isCorrect: false },
												{
													key: 'B',
													content: 'So it is to the right of the entrance.',
													isCorrect: false,
												},
												{ key: 'C', content: 'Where the waiting area is.', isCorrect: true },
												{
													key: 'D',
													content: 'They will move the help desk instead.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
								],
							},
						},
						// Q65–67 (graphic)
						{
							id: 's13_12',
							examId: '1',
							order: 12,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q65-67.mp3' }, { fileId: 'SYSTEM_65-67.jpg' }],
							},
							questions: {
								create: [
									{
										order: 65,
										content: 'What did the man say about next week?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'There will be an inspection.', isCorrect: false },
												{ key: 'B', content: 'Some new computers will arrive.', isCorrect: false },
												{ key: 'C', content: 'They will have fire drills.', isCorrect: true },
												{ key: 'D', content: 'Someone called in sick.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 66,
										content: 'Look at the graphic. What department do the speakers work in?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Human Resources', isCorrect: false },
												{ key: 'B', content: 'Accounting', isCorrect: false },
												{ key: 'C', content: 'Customer Service', isCorrect: false },
												{ key: 'D', content: 'Legal', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
									{
										order: 67,
										content: 'What does the woman suggest they do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "Don't say anything", isCorrect: false },
												{ key: 'B', content: 'Print out some extra copies', isCorrect: false },
												{ key: 'C', content: 'Speak to their supervisor', isCorrect: true },
												{ key: 'D', content: 'Put up a sign', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q68–70 (graphic)
						{
							id: 's13_13',
							examId: '1',
							order: 13,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q68-70.mp3' }, { fileId: 'SYSTEM_68-70.jpg' }],
							},
							questions: {
								create: [
									{
										order: 68,
										content: 'Where does the man most likely work?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Chemist', isCorrect: false },
												{ key: 'B', content: 'Hardware store', isCorrect: false },
												{ key: 'C', content: 'Model shop', isCorrect: true },
												{ key: 'D', content: 'Medical clinic', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 69,
										content: 'Look at the graphic. What part is the woman missing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Decals', isCorrect: false },
												{ key: 'B', content: 'Model Kit', isCorrect: false },
												{ key: 'C', content: 'Snap fit tool', isCorrect: true },
												{ key: 'D', content: 'Rubber tires', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
									{
										order: 70,
										content: 'What does the man offer to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Deliver it to her', isCorrect: false },
												{ key: 'B', content: 'Give her a refund', isCorrect: false },
												{ key: 'C', content: 'Cancel the order', isCorrect: false },
												{ key: 'D', content: 'Express-post it to her', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['TOEIC Listening Part 3']) },
			},

			// ─────────────────────────────────────────────────────────────────
			// PART 4 — Talks (Q71–100)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's14',
				order: 4,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Q71–73
						{
							id: 's141',
							examId: '1',
							order: 1,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q71-73.mp3' }] },
							questions: {
								create: [
									{
										order: 71,
										content: 'What did the listener offer to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Attend a meeting', isCorrect: false },
												{ key: 'B', content: 'Go to New York', isCorrect: false },
												{ key: 'C', content: "Take care of the speaker's child", isCorrect: true },
												{ key: 'D', content: 'Lend a personal item', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 72,
										content: 'What will happen in April?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'An annual conference', isCorrect: false },
												{ key: 'B', content: 'A business merger', isCorrect: true },
												{ key: 'C', content: 'A budget review', isCorrect: false },
												{ key: 'D', content: 'A town meeting', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 73,
										content: 'What will the listener most likely inform the speaker about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The time of arrival', isCorrect: false },
												{ key: 'B', content: 'The payment', isCorrect: true },
												{ key: 'C', content: 'An event location', isCorrect: false },
												{ key: 'D', content: 'A weekend schedule', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// Q74–76
						{
							id: 's142',
							examId: '1',
							order: 2,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q74-76.mp3' }] },
							questions: {
								create: [
									{
										order: 74,
										content: 'Where most likely is this announcement being made?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'In a factory', isCorrect: false },
												{ key: 'B', content: 'On an airplane', isCorrect: false },
												{ key: 'C', content: 'At a bus terminal', isCorrect: false },
												{ key: 'D', content: 'At an airport', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 75,
										content: 'What can listeners receive at the counter?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A name tag', isCorrect: false },
												{ key: 'B', content: 'A receipt', isCorrect: false },
												{ key: 'C', content: 'A meal ticket', isCorrect: false },
												{ key: 'D', content: 'Some refreshments', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 76,
										content: 'What are listeners asked to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Form a line', isCorrect: false },
												{ key: 'B', content: 'Stay nearby', isCorrect: true },
												{ key: 'C', content: 'Sign a document', isCorrect: false },
												{ key: 'D', content: 'Present a ticket', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q77–79
						{
							id: 's143',
							examId: '1',
							order: 3,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q77-79.mp3' }] },
							questions: {
								create: [
									{
										order: 77,
										content: 'Where most likely is the speaker?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'In a museum', isCorrect: true },
												{ key: 'B', content: 'In a library', isCorrect: false },
												{ key: 'C', content: 'In a lecture hall', isCorrect: false },
												{ key: 'D', content: 'In a gift shop', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 78,
										content: 'According to the speaker, what is Dr. Simmons famous for?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Writing best-selling books', isCorrect: false },
												{ key: 'B', content: 'Making important discoveries', isCorrect: true },
												{ key: 'C', content: 'Finding ancient buildings', isCorrect: false },
												{
													key: 'D',
													content: 'Conducting groundbreaking experiments',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 79,
										content: 'What does the speaker request that listeners do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Purchase a day pass', isCorrect: false },
												{ key: 'B', content: 'Turn off a camera', isCorrect: false },
												{ key: 'C', content: 'Refrain from using a flash', isCorrect: true },
												{ key: 'D', content: 'Stay with the group', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// Q80–82
						{
							id: 's144',
							examId: '1',
							order: 4,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q80-82.mp3' }] },
							questions: {
								create: [
									{
										order: 80,
										content: 'What is the speaker mainly discussing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A company picnic', isCorrect: false },
												{ key: 'B', content: 'A job opportunity', isCorrect: false },
												{ key: 'C', content: 'A new benefit', isCorrect: true },
												{ key: 'D', content: 'Overseas expansion', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Topic Purpose']) },
									},
									{
										order: 81,
										content: 'According to the speaker, what can listeners do online?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Find out a new payment', isCorrect: true },
												{ key: 'B', content: 'Register for a workshop', isCorrect: false },
												{ key: 'C', content: 'Remit a monthly payment', isCorrect: false },
												{ key: 'D', content: 'Review a proposal', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 82,
										content: 'Why should some listeners contact Suzie Summers?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To request a schedule change', isCorrect: false },
												{ key: 'B', content: 'To obtain personal information', isCorrect: true },
												{ key: 'C', content: 'To cancel a subscription', isCorrect: false },
												{ key: 'D', content: 'To congratulate a co-worker', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q83–85
						{
							id: 's145',
							examId: '1',
							order: 5,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q83-85.mp3' }] },
							questions: {
								create: [
									{
										order: 83,
										content: 'Who most likely are the listeners?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Lawyers', isCorrect: false },
												{ key: 'B', content: 'Accountants', isCorrect: true },
												{ key: 'C', content: 'Bankers', isCorrect: false },
												{ key: 'D', content: 'Chefs', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 84,
										content:
											'What does the woman mean when she says, "I know that you are all very busy"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'She wants to organize a meeting.', isCorrect: false },
												{ key: 'B', content: 'She needs more printers.', isCorrect: false },
												{
													key: 'C',
													content: 'She is recognizing their concerns.',
													isCorrect: true,
												},
												{ key: 'D', content: "She isn't sure what to do.", isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Implication']) },
									},
									{
										order: 85,
										content: 'What task does the speaker assign to the listeners?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Spend a week with the interns', isCorrect: true },
												{ key: 'B', content: "Don't speak to the interns", isCorrect: false },
												{ key: 'C', content: 'Write a training manual', isCorrect: false },
												{ key: 'D', content: 'Report on sales figures', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q86–88
						{
							id: 's146',
							examId: '1',
							order: 6,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q86-88.mp3' }] },
							questions: {
								create: [
									{
										order: 86,
										content: "What product does the speaker's company sell?",
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Electronics', isCorrect: true },
												{ key: 'B', content: 'Food', isCorrect: false },
												{ key: 'C', content: 'Clothing', isCorrect: false },
												{ key: 'D', content: 'Apparel', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 87,
										content: 'What problem does the speaker describe?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'She thinks there is not a problem.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'Some products are not selling well.',
													isCorrect: true,
												},
												{ key: 'C', content: 'They have a new competitor.', isCorrect: false },
												{ key: 'D', content: 'They will have to cut staff.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 88,
										content: 'What does the woman mean when she says, "Sit in on the meeting"?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'She will send employees an email.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'She wants employees to prepare a report.',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'She wants employees to come to the meeting.',
													isCorrect: true,
												},
												{ key: 'D', content: 'She will have a conference call.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Implication']) },
									},
								],
							},
						},
						// Q89–91
						{
							id: 's147',
							examId: '1',
							order: 7,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_q89-91.mp3' }] },
							questions: {
								create: [
									{
										order: 89,
										content: "What product does the speaker's company sell?",
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Heating products', isCorrect: true },
												{ key: 'B', content: 'Air conditioners', isCorrect: false },
												{ key: 'C', content: 'Vacuum cleaners', isCorrect: false },
												{ key: 'D', content: 'Magazines', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 90,
										content: 'According to the speaker, what happened last month?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'They signed a special contract.', isCorrect: true },
												{ key: 'B', content: 'They bought out another company.', isCorrect: false },
												{ key: 'C', content: 'They traded stocks.', isCorrect: false },
												{ key: 'D', content: 'Their sales went down.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 91,
										content: 'What does the man mean when he says "How about that?"',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'He is confused about the situation.',
													isCorrect: false,
												},
												{ key: 'B', content: 'He is pleased with the results.', isCorrect: true },
												{ key: 'C', content: "He isn't happy.", isCorrect: false },
												{
													key: 'D',
													content: 'He wants to try to upgrade their computers.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Implication']) },
									},
								],
							},
						},
						// Q92–94 (graphic)
						{
							id: 's148',
							examId: '1',
							order: 8,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q92-94.mp3' }, { fileId: 'SYSTEM_92-94.jpg' }],
							},
							questions: {
								create: [
									{
										order: 92,
										content: 'What is indicated about Springfield Dance Troupe?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'They are changing the music they like.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'They are moving to a new location.',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'They want to find a new swing class instructor.',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'They are changing the courses they will offer.',
													isCorrect: true,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 93,
										content: 'Look at the graphic. What can you infer about the dance classes?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'They will be difficult.', isCorrect: false },
												{ key: 'B', content: 'They are for beginners.', isCorrect: false },
												{
													key: 'C',
													content: 'Dance classes last for three hours.',
													isCorrect: true,
												},
												{ key: 'D', content: 'They are coed.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
									{
										order: 94,
										content: 'What does Springfield Dance Troupe invite the public to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Come to their picnic', isCorrect: false },
												{
													key: 'B',
													content: 'See them in the concert hall downtown',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'Watch them perform a hip hop dance routine',
													isCorrect: true,
												},
												{ key: 'D', content: 'Say goodbye to Sally Jones', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Q95–97 (graphic)
						{
							id: 's149',
							examId: '1',
							order: 9,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q95-97.mp3' }, { fileId: 'SYSTEM_95-97.jpg' }],
							},
							questions: {
								create: [
									{
										order: 95,
										content: 'What is indicated in the advertisement?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content:
														'Presidential Tailoring is just getting started in their business',
													isCorrect: false,
												},
												{
													key: 'B',
													content:
														'Jeffrey Frye is an experienced American tailor trained overseas',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'Presidential Tailors is having a big sale',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'They only have one tailor on staff',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 96,
										content: 'Look at the graphic. What is true about the pricing?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'It can change based upon what material people want',
													isCorrect: true,
												},
												{ key: 'B', content: "Women's gowns are popular", isCorrect: false },
												{
													key: 'C',
													content: 'Most people choose the trousers because they are a good deal',
													isCorrect: false,
												},
												{ key: 'D', content: "Women's ensembles are overpriced", isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
									{
										order: 97,
										content: 'What can you infer about Presidential Tailoring?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'They are a discount clothier.', isCorrect: false },
												{ key: 'B', content: 'They work with leather.', isCorrect: false },
												{ key: 'C', content: 'Their target market is children.', isCorrect: false },
												{
													key: 'D',
													content: 'They take a lot of pride in their work.',
													isCorrect: true,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// Q98–100 (graphic)
						{
							id: 's14_10',
							examId: '1',
							order: 10,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_q98-100.mp3' }, { fileId: 'SYSTEM_98-100.jpg' }],
							},
							questions: {
								create: [
									{
										order: 98,
										content: 'Look at the graphic. Which volume discounts are incorrect?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Foot stools 3%', isCorrect: true },
												{ key: 'B', content: 'Chairs 0%', isCorrect: false },
												{ key: 'C', content: 'Small end tables 5%', isCorrect: false },
												{ key: 'D', content: 'Large end tables 5%', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Graphic Based']) },
									},
									{
										order: 99,
										content: 'What is the listener asked to do with the invoice?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'Change the Large end table orders to two dozen',
													isCorrect: false,
												},
												{ key: 'B', content: 'Make the invoice match the order', isCorrect: true },
												{
													key: 'C',
													content: 'Send the invoice to the factory for completion',
													isCorrect: false,
												},
												{ key: 'D', content: 'Send the invoice to accounting', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
									{
										order: 100,
										content: 'What does the speaker anticipate will happen next?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'She will receive her order.', isCorrect: false },
												{ key: 'B', content: 'She will receive a new invoice.', isCorrect: true },
												{
													key: 'C',
													content: 'She will have to place the order a third time.',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'She will need to use a different supplier',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['TOEIC Listening Part 4']) },
			},
		];
	}
}
