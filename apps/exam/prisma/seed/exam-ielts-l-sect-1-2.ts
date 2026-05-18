import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class IeltsLExamSect12Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PART 1 — Short Stay Accommodation Form (Q1–10)
			// Flat section — 1 question group, fill-in-the-blank
			// group_instruction HTML stored as content of Q1 (first question)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's21',
				order: 1,
				contentType: SectionType.Question,
				directive: `<div><p><em>Complete the form below.</em><br/>
<em>Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</em></p>
<p><strong>SHORT STAY ACCOMMODATION</strong></p>
<p><strong>Family Name:</strong> Mackinlay<br/>
<strong>First Name:</strong> ____1____<br/>
<strong>Country of Origin:</strong> ____2____<br/>
<strong>Date of Arrival:</strong> ____3____<br/>
<strong>Number of Tenants:</strong> ____4____<br/>
<strong>Length of Stay:</strong> 2 weeks<br/>
<strong>Purpose of Visit:</strong> ____5____<br/>
<strong>Type of Accommodation:</strong> ____6____<br/>
<strong>Number of Bedrooms:</strong> one or two<br/>
<strong>Car Parking:</strong> off-street and ____7____<br/>
<strong>General Area:</strong> near the beach<br/>
<strong>Other Requirements:</strong> near ____8____<br/>
<strong>Name of Town:</strong> ____9____<br/>
<strong>Client's Email:</strong> smac13@hotmail.com<br/>
<strong>Price Range:</strong> up to $ ____10____ a week</p></div>`,
				questions: {
					create: [
						{
							order: 1,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: 'SYLVIA', isCorrect: true }],
							},
							questionFiles: { create: [{ fileId: 'SYSTEM_sim_0101.mp3' }] },
							questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
						},
						{
							order: 2,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: 'ENGLAND', isCorrect: true }],
							},
						},
						{
							order: 3,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [
									{ key: '26TH (OF) JULY', isCorrect: true },
									{ key: '26TH JULY', isCorrect: true },
									{ key: 'JULY 26(TH)', isCorrect: true },
									{ key: 'JULY 26', isCorrect: true },
									{ key: '26 JULY', isCorrect: true },
								],
							},
						},
						{
							order: 4,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [
									{ key: 'TWO', isCorrect: true },
									{ key: '2', isCorrect: true },
								],
							},
						},
						{
							order: 5,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [
									{ key: '(ON) HOLIDAY', isCorrect: true },
									{ key: 'ON HOLIDAY', isCorrect: true },
									{ key: 'HOLIDAY', isCorrect: true },
								],
							},
						},
						{
							order: 6,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: 'APARTMENT', isCorrect: true }],
							},
						},
						{
							order: 7,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: 'SECURE', isCorrect: true }],
							},
						},
						{
							order: 8,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [
									{ key: '(THE) MOTORWAY', isCorrect: true },
									{ key: 'THE MOTORWAY', isCorrect: true },
									{ key: 'MOTORWAY', isCorrect: true },
									{ key: '(THE) M1', isCorrect: true },
									{ key: 'THE M1', isCorrect: true },
									{ key: 'M1', isCorrect: true },
									{ key: 'MOTORWAY ACCESS', isCorrect: true },
								],
							},
						},
						{
							order: 9,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: 'PALM BEACH', isCorrect: true }],
							},
						},
						{
							order: 10,
							type: QuestionType.FillAnyInTheBlank,
							choices: {
								create: [{ key: '1500', isCorrect: true }],
							},
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
			},

			// ─────────────────────────────────────────────────────────────────
			// PART 2 — Walking Club (Q11–20)
			// Group 1: MCQ (Q11–14) | Group 2: Fill table (Q15–20)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's22',
				order: 2,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: MCQ Q11–14
						{
							id: 's221',
							examId: '2',
							order: 1,
							contentType: SectionType.Question,
							directive: `<div><p><em>Choose the correct letter, A, B or C.</em></p></div>`,
							questions: {
								create: [
									{
										order: 11,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'at the front counter.', isCorrect: false },
												{ key: 'B', content: 'in the lobby.', isCorrect: true },
												{ key: 'C', content: 'at the back of the hall.', isCorrect: false },
											],
										},
										questionFiles: { create: [{ fileId: 'SYSTEM_sim_0102.mp3' }] },
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 12,
										content: 'Nick Noble advertised',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'on the radio.', isCorrect: true },
												{ key: 'B', content: 'on a billboard.', isCorrect: false },
												{ key: 'C', content: 'in the newspaper.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 13,
										content: 'The original number of founding members was about',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: '12.', isCorrect: true },
												{ key: 'B', content: '20.', isCorrect: false },
												{ key: 'C', content: '200.', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 14,
										content: 'The club provides activities primarily for reasonably fit',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'A', content: 'males up to 75.', isCorrect: false },
												{ key: 'B', content: 'females with young children.', isCorrect: false },
												{ key: 'C', content: 'males and females of any age.', isCorrect: true },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
								],
							},
						},
						// Group 2: Fill table Q15–20
						{
							id: 's222',
							examId: '2',
							order: 2,
							contentType: SectionType.Question,
							directive: `<div><p><em>Complete the table below.</em><br/>
<em>Write <strong>NO MORE THAN ONE WORD AND/OR A NUMBER</strong> for each answer.</em></p>
<table><tbody>
<tr><td>Activity</td><td>Day(s)</td><td>Duration</td><td>Contact person</td></tr>
<tr><td>____15____</td><td>Tuesday &amp; Saturday</td><td>about 3-5 hours</td><td>coordinator</td></tr>
<tr><td>____16____</td><td>Thursday &amp; Sunday</td><td>up to 3 hours</td><td>____17____</td></tr>
<tr><td>Wanderers</td><td>Sunday</td><td>____18____</td><td>leader</td></tr>
<tr><td>____19____ Weekends</td><td>Saturday &amp; Sunday</td><td>all weekend</td><td>____20____</td></tr>
</tbody></table></div>`,
							questions: {
								create: [
									{
										order: 15,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'TRAMPING', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
									},
									{
										order: 16,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'WALKING', isCorrect: true },
												{ key: 'WALKS', isCorrect: true },
											],
										},
									},
									{
										order: 17,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'ORGANIZER', isCorrect: true },
												{ key: 'ORGANISER', isCorrect: true },
											],
										},
									},
									{
										order: 18,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'VARIABLE', isCorrect: true }],
										},
									},
									{
										order: 19,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'MYSTERY', isCorrect: true }],
										},
									},
									{
										order: 20,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'CHAIRMAN', isCorrect: true }],
										},
									},
								],
							},
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
			},
		];
	}
}
