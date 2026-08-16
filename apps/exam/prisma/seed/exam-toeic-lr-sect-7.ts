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
						// ── Group 1: Q147–148 — Memo ────────────────────────────────────
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
										content: 'What is the purpose of this memo?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'To ask employees not to take the elevator',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'To inform employees of elevator maintenance',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'To address employee complaints about the elevator',
													isCorrect: false,
												},
												{
													key: 'D',
													content: 'To notify employees of the new elevator schedule',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 148,
										content: 'The word "serviced" in line 3 is closest in meaning to',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'cleaned', isCorrect: false },
												{ key: 'B', content: 'offered', isCorrect: false },
												{ key: 'C', content: 'maintained', isCorrect: true },
												{ key: 'D', content: 'operated', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Synonym In Context']) },
									},
								],
							},
						},
						// ── Group 2: Q149–150 — Notice ──────────────────────────────────
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
										content: 'What is the notice mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A product replacement program', isCorrect: true },
												{ key: 'B', content: 'How to use a product correctly', isCorrect: false },
												{ key: 'C', content: 'Safe storage of electrical items', isCorrect: false },
												{ key: 'D', content: 'A new cooking appliance', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Announcement Notice']),
										},
									},
									{
										order: 150,
										content: 'What should customers do to receive a replacement?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Visit the store', isCorrect: false },
												{ key: 'B', content: 'Call a phone number', isCorrect: true },
												{ key: 'C', content: 'Fill out a form online', isCorrect: false },
												{ key: 'D', content: 'Mail back the defective item', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 3: Q151–152 — E-mail ──────────────────────────────────
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
										content: 'What is the e-mail about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A new product launch', isCorrect: false },
												{ key: 'B', content: 'A job opening', isCorrect: true },
												{ key: 'C', content: 'A company policy update', isCorrect: false },
												{ key: 'D', content: 'A client meeting', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 152,
										content: 'What is Lisa Wu asked to include with her application?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A cover letter', isCorrect: false },
												{ key: 'B', content: 'A portfolio', isCorrect: false },
												{ key: 'C', content: 'A list of references', isCorrect: true },
												{ key: 'D', content: 'A writing sample', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 4: Q153–154 — Notice ──────────────────────────────────
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
										content: 'Where would this notice most likely be found?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'In a restaurant', isCorrect: false },
												{ key: 'B', content: 'In a gym', isCorrect: true },
												{ key: 'C', content: 'At a school', isCorrect: false },
												{ key: 'D', content: 'At a hotel', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Inference', 'Announcement Notice']),
										},
									},
									{
										order: 154,
										content: 'What change will take effect on Monday?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'New hours of operation', isCorrect: true },
												{ key: 'B', content: 'New staff members', isCorrect: false },
												{ key: 'C', content: 'New pricing', isCorrect: false },
												{ key: 'D', content: 'New equipment', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 5: Q155–157 — Letter ──────────────────────────────────
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
										content: 'Who is the letter addressed to?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A new employee', isCorrect: false },
												{ key: 'B', content: 'A job applicant', isCorrect: true },
												{ key: 'C', content: 'A long-term customer', isCorrect: false },
												{ key: 'D', content: 'A business partner', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 156,
										content: 'What is true about the position?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It involves travel.', isCorrect: true },
												{ key: 'B', content: 'It is part-time.', isCorrect: false },
												{ key: 'C', content: 'It requires a graduate degree.', isCorrect: false },
												{ key: 'D', content: 'It is temporary.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 157,
										content: 'What is the applicant asked to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Send a revised resume', isCorrect: false },
												{ key: 'B', content: 'Call to confirm the interview', isCorrect: true },
												{ key: 'C', content: 'Complete an online application', isCorrect: false },
												{ key: 'D', content: 'Attend an orientation session', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// ── Group 6: Q158–160 — Advertisement ───────────────────────────
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
										content: 'What is being advertised?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A cooking class', isCorrect: false },
												{ key: 'B', content: 'A catering service', isCorrect: false },
												{ key: 'C', content: 'A kitchen appliance', isCorrect: true },
												{ key: 'D', content: 'A food delivery service', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 159,
										content: 'What is offered with the purchase?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A free recipe book', isCorrect: false },
												{ key: 'B', content: 'Extended warranty', isCorrect: true },
												{ key: 'C', content: 'Free installation', isCorrect: false },
												{ key: 'D', content: 'A discount coupon', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 160,
										content: 'How can customers get more information?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Visit a showroom', isCorrect: false },
												{ key: 'B', content: 'Send an e-mail', isCorrect: false },
												{ key: 'C', content: 'Visit a website', isCorrect: true },
												{ key: 'D', content: 'Call a hotline', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 7: Q161–163 — Article ─────────────────────────────────
						{
							id: 's177',
							examId: '1',
							order: 7,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_161-163.jpg' }] },
							questions: {
								create: [
									{
										order: 161,
										content: 'What is the article mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A new transit system', isCorrect: false },
												{ key: 'B', content: 'A city planning project', isCorrect: true },
												{ key: 'C', content: 'A local business initiative', isCorrect: false },
												{ key: 'D', content: 'Environmental regulations', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 162,
										content: 'According to the article, when will the project begin?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Next month', isCorrect: false },
												{ key: 'B', content: 'Next spring', isCorrect: true },
												{ key: 'C', content: 'In two years', isCorrect: false },
												{ key: 'D', content: 'Next fall', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 163,
										content: 'What concern do residents have?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Noise pollution', isCorrect: false },
												{ key: 'B', content: 'Construction costs', isCorrect: false },
												{ key: 'C', content: 'Traffic disruptions', isCorrect: true },
												{ key: 'D', content: 'Loss of green space', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 8: Q164–167 — E-mail ──────────────────────────────────
						{
							id: 's178',
							examId: '1',
							order: 8,
							contentType: SectionType.Question,
							sectionFiles: { create: [{ fileId: 'SYSTEM_164-167.jpg' }] },
							questions: {
								create: [
									{
										order: 164,
										content: 'What is the purpose of the e-mail?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'To respond to a complaint', isCorrect: false },
												{ key: 'B', content: 'To request feedback on a service', isCorrect: true },
												{ key: 'C', content: 'To announce a new policy', isCorrect: false },
												{ key: 'D', content: 'To confirm a reservation', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 165,
										content: 'Who most likely is Chen Li?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A hotel manager', isCorrect: false },
												{ key: 'B', content: 'A travel agent', isCorrect: false },
												{ key: 'C', content: 'A hotel guest', isCorrect: true },
												{ key: 'D', content: 'A restaurant employee', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 166,
										content: 'What is NOT mentioned as an amenity?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Free breakfast', isCorrect: true },
												{ key: 'B', content: 'A swimming pool', isCorrect: false },
												{ key: 'C', content: 'Free Wi-Fi', isCorrect: false },
												{ key: 'D', content: 'A fitness center', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Exception NOT true']) },
									},
									{
										order: 167,
										content: 'What is the recipient asked to do?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Call customer service', isCorrect: false },
												{ key: 'B', content: 'Complete an online survey', isCorrect: true },
												{ key: 'C', content: 'Return to the hotel', isCorrect: false },
												{ key: 'D', content: 'Send a written review', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// ── Group 9: Q168–171 — Advertisement ───────────────────────────
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
										content: 'What type of business is described in the passage?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'An accounting firm', isCorrect: false },
												{ key: 'B', content: 'A software company', isCorrect: true },
												{ key: 'C', content: 'A retail store', isCorrect: false },
												{ key: 'D', content: 'A consulting agency', isCorrect: false },
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
										order: 169,
										content: 'What is the company looking for in candidates?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Sales experience', isCorrect: false },
												{ key: 'B', content: 'Programming skills', isCorrect: true },
												{ key: 'C', content: 'Marketing knowledge', isCorrect: false },
												{ key: 'D', content: 'Customer service skills', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 170,
										content: 'What benefit is specifically mentioned?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Flexible working hours', isCorrect: true },
												{ key: 'B', content: 'Monthly bonuses', isCorrect: false },
												{ key: 'C', content: 'Company car', isCorrect: false },
												{ key: 'D', content: 'Childcare assistance', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 171,
										content: 'How should interested applicants apply?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'By visiting the office', isCorrect: false },
												{ key: 'B', content: 'By sending a fax', isCorrect: false },
												{ key: 'C', content: 'By submitting a resume online', isCorrect: true },
												{ key: 'D', content: 'By calling the HR department', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// ── Group 10: Q172–175 — Article ────────────────────────────────
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
										content: 'What is the article mainly about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A new product launch', isCorrect: false },
												{ key: 'B', content: 'An award-winning company', isCorrect: true },
												{ key: 'C', content: 'A stock market update', isCorrect: false },
												{ key: 'D', content: 'An industry report', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 173,
										content: 'Why is the company being recognized?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'For its innovative technology', isCorrect: true },
												{ key: 'B', content: 'For its community service', isCorrect: false },
												{
													key: 'C',
													content: 'For its customer satisfaction rate',
													isCorrect: false,
												},
												{ key: 'D', content: 'For its environmental policies', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 174,
										content: 'Who presented the award?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A local mayor', isCorrect: false },
												{ key: 'B', content: 'The industry association', isCorrect: true },
												{ key: 'C', content: 'A government official', isCorrect: false },
												{ key: 'D', content: 'A university board', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 175,
										content: 'What does the CEO say about the future?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'The company plans to expand internationally.',
													isCorrect: true,
												},
												{
													key: 'B',
													content: 'The company will release a new product soon.',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'The company is merging with a competitor.',
													isCorrect: false,
												},
												{ key: 'D', content: 'The company will reduce staff.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 11: Q176–180 — Double passage (Form + E-mail) ─────────
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
										content: 'What is the first document about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A job posting', isCorrect: false },
												{ key: 'B', content: 'A company newsletter', isCorrect: false },
												{ key: 'C', content: 'A service agreement', isCorrect: true },
												{ key: 'D', content: 'A product manual', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Form Schedule List']),
										},
									},
									{
										order: 177,
										content: 'What is true about the second document?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: "It confirms the client's order.", isCorrect: true },
												{
													key: 'B',
													content: 'It lists the terms of a contract.',
													isCorrect: false,
												},
												{
													key: 'C',
													content: 'It provides installation instructions.',
													isCorrect: false,
												},
												{ key: 'D', content: 'It announces a price increase.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 178,
										content: 'What can be inferred about the company?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: 'It has recently merged with another firm.',
													isCorrect: false,
												},
												{
													key: 'B',
													content: 'It specializes in office equipment.',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'It is expanding to a new location.',
													isCorrect: false,
												},
												{ key: 'D', content: 'It is a newly founded business.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
									{
										order: 179,
										content: 'When will the delivery take place?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Monday', isCorrect: false },
												{ key: 'B', content: 'Tuesday', isCorrect: false },
												{ key: 'C', content: 'Wednesday', isCorrect: true },
												{ key: 'D', content: 'Friday', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 180,
										content: 'What is the customer asked to do upon receipt?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Sign a delivery form', isCorrect: true },
												{ key: 'B', content: 'Call customer support', isCorrect: false },
												{ key: 'C', content: 'Register the product online', isCorrect: false },
												{ key: 'D', content: 'Return the old equipment', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// ── Group 12: Q181–185 — Double passage (Ad + E-mail) ───────────
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
										content: 'What is the first passage about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A training program', isCorrect: false },
												{ key: 'B', content: 'A promotional event', isCorrect: true },
												{ key: 'C', content: 'A budget proposal', isCorrect: false },
												{ key: 'D', content: 'A company relocation', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 182,
										content: 'Who sent the second document?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A supplier', isCorrect: false },
												{ key: 'B', content: 'A customer', isCorrect: true },
												{ key: 'C', content: 'A government agency', isCorrect: false },
												{ key: 'D', content: 'A colleague', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 183,
										content: 'What does the writer of the second passage request?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A refund', isCorrect: false },
												{ key: 'B', content: 'More information about the event', isCorrect: true },
												{ key: 'C', content: 'A product replacement', isCorrect: false },
												{ key: 'D', content: 'A meeting appointment', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
									{
										order: 184,
										content: 'What does the first passage indicate about the discount?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It applies only to new members.', isCorrect: false },
												{
													key: 'B',
													content: 'It is available for a limited time.',
													isCorrect: true,
												},
												{ key: 'C', content: 'It requires a minimum purchase.', isCorrect: false },
												{ key: 'D', content: 'It is offered online only.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 185,
										content: 'What can be inferred from the two passages?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The customer is a regular client.', isCorrect: true },
												{ key: 'B', content: 'The event was cancelled.', isCorrect: false },
												{ key: 'C', content: 'The company is relocating.', isCorrect: false },
												{
													key: 'D',
													content: 'The discount was already applied.',
													isCorrect: false,
												},
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 13: Q186–190 — Double passage (Ad + Letter) ───────────
						{
							id: 's17_13',
							examId: '1',
							order: 13,
							contentType: SectionType.Question,
							sectionFiles: {
								create: [{ fileId: 'SYSTEM_186-190.jpg' }, { fileId: 'SYSTEM_186-190_2.jpg' }],
							},
							questions: {
								create: [
									{
										order: 186,
										content: 'What is the first document?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A job advertisement', isCorrect: true },
												{ key: 'B', content: 'A meeting agenda', isCorrect: false },
												{ key: 'C', content: 'A press release', isCorrect: false },
												{ key: 'D', content: 'A company memo', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 187,
										content: 'What skill is required for the position advertised?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Graphic design', isCorrect: false },
												{ key: 'B', content: 'Data analysis', isCorrect: true },
												{ key: 'C', content: 'Public relations', isCorrect: false },
												{ key: 'D', content: 'Project management', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 188,
										content: 'What does the second passage indicate about the applicant?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'She has ten years of experience.', isCorrect: false },
												{
													key: 'B',
													content: 'She currently works in the same field.',
													isCorrect: true,
												},
												{
													key: 'C',
													content: 'She is relocating from another city.',
													isCorrect: false,
												},
												{ key: 'D', content: 'She does not have a degree.', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 189,
										content: 'What does the applicant enclose with her letter?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A writing sample', isCorrect: false },
												{ key: 'B', content: 'A resume', isCorrect: true },
												{ key: 'C', content: 'A reference letter', isCorrect: false },
												{ key: 'D', content: 'A certificate', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 190,
										content: 'What does the applicant request?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A phone interview', isCorrect: false },
												{ key: 'B', content: 'An in-person interview', isCorrect: true },
												{ key: 'C', content: 'A company tour', isCorrect: false },
												{ key: 'D', content: 'A job description', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Request Suggestion']) },
									},
								],
							},
						},
						// ── Group 14: Q191–195 — Triple passage ──────────────────────────
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
										content: 'What is the topic of the first passage?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A conference schedule', isCorrect: false },
												{ key: 'B', content: 'A product review', isCorrect: true },
												{ key: 'C', content: 'An employee survey', isCorrect: false },
												{ key: 'D', content: 'A financial report', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Advertisement Article']),
										},
									},
									{
										order: 192,
										content: 'What criticism is mentioned in the second passage?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Poor packaging', isCorrect: false },
												{ key: 'B', content: 'High price', isCorrect: true },
												{ key: 'C', content: 'Limited availability', isCorrect: false },
												{ key: 'D', content: 'Slow customer service', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 193,
										content: 'What is the purpose of the third passage?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{
													key: 'A',
													content: "To respond to a customer's complaint",
													isCorrect: true,
												},
												{ key: 'B', content: 'To announce a new policy', isCorrect: false },
												{ key: 'C', content: 'To introduce a new product', isCorrect: false },
												{ key: 'D', content: 'To request a refund', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Email Letter Memo']),
										},
									},
									{
										order: 194,
										content: 'What does the company offer as compensation?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A full refund', isCorrect: false },
												{ key: 'B', content: 'A discount voucher', isCorrect: true },
												{ key: 'C', content: 'A free replacement', isCorrect: false },
												{ key: 'D', content: 'Store credit', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 195,
										content: 'What can be inferred about the product?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It is sold exclusively online.', isCorrect: false },
												{ key: 'B', content: 'It recently received an award.', isCorrect: false },
												{
													key: 'C',
													content: 'It is popular despite mixed reviews.',
													isCorrect: true,
												},
												{ key: 'D', content: 'It is being discontinued.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
									},
								],
							},
						},
						// ── Group 15: Q196–200 — Triple passage ──────────────────────────
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
										content: 'What is the first document about?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A travel itinerary', isCorrect: false },
												{ key: 'B', content: 'A hotel booking confirmation', isCorrect: true },
												{ key: 'C', content: 'A flight reservation', isCorrect: false },
												{ key: 'D', content: 'A rental car agreement', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Topic Purpose', 'Form Schedule List']),
										},
									},
									{
										order: 197,
										content: 'What concern does the writer of the second passage express?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'The check-in time is too late.', isCorrect: true },
												{ key: 'B', content: 'The room rate is too high.', isCorrect: false },
												{ key: 'C', content: 'The hotel does not have parking.', isCorrect: false },
												{
													key: 'D',
													content: 'The reservation was not confirmed.',
													isCorrect: false,
												},
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 198,
										content: 'What does the third passage confirm?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'A room upgrade was provided.', isCorrect: false },
												{
													key: 'B',
													content: 'The check-in issue has been resolved.',
													isCorrect: true,
												},
												{ key: 'C', content: 'A refund was issued.', isCorrect: false },
												{ key: 'D', content: 'The booking was cancelled.', isCorrect: false },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Email Letter Memo']),
										},
									},
									{
										order: 199,
										content: 'What is indicated about the hotel?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'It offers an airport shuttle.', isCorrect: true },
												{ key: 'B', content: 'It does not allow pets.', isCorrect: false },
												{
													key: 'C',
													content: 'It has recently renovated its rooms.',
													isCorrect: false,
												},
												{ key: 'D', content: 'It offers complimentary parking.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 200,
										content: 'What will the guest most likely do next?',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'Cancel the reservation', isCorrect: false },
												{ key: 'B', content: 'Contact the travel agency', isCorrect: false },
												{ key: 'C', content: 'Check in at an earlier time', isCorrect: true },
												{ key: 'D', content: 'Book a different hotel', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Inference']) },
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
