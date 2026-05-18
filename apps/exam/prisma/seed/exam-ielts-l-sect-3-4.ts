import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class IeltsLExamSect34Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PART 3 — OECD Report: Students and Technology (Q21–30)
			// Group 1: Notes (Q21–26) | Group 2: Table (Q27–30)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's23',
				order: 3,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: Notes fill Q21–26
						{
							id: 's231',
							examId: '2',
							order: 1,
							contentType: SectionType.Question,
							directive: `<div><p><em>Complete the notes below.</em><br/>
<em>Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</em></p>
<p><strong>OECD Report: Students and Technology</strong></p>
<p>Background notes from conversation with Dr Judy Chen<br/>
(Researcher at University's Education Policy Institute)</p>
<table><tbody>
<tr><td>Database code:</td><td>____21____</td></tr>
<tr><td>Source material:</td><td>OECD report on students and technology in schools</td></tr>
<tr><td>Main focus:</td><td>how technology affects learning outcomes</td></tr>
</tbody></table>
<p><strong>About the OECD Report</strong></p>
<ul>
<li>Looked at ____22____ use in schools in 70+ countries</li>
<li>Examined how technology connects with ____23____</li>
<li>Measured ____24____ on performance in reading, maths, science</li>
<li>Included recommendations for ____25____</li>
</ul>
<p>Dr Chen's involvement:<br/>
– gave ____26____ at national education conference</p></div>`,
							questions: {
								create: [
									{
										order: 21,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'ED 995', isCorrect: true },
												{ key: 'ED995', isCorrect: true },
											],
										},
										questionFiles: { create: [{ fileId: 'SYSTEM_sim_0103.mp3' }] },
										questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
									},
									{
										order: 22,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'DOCUMENT', isCorrect: true }],
										},
									},
									{
										order: 23,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'SOCIO-ECONOMIC STRUCTURES', isCorrect: true },
												{ key: 'SOCIOECONOMIC STRUCTURES', isCorrect: true },
											],
										},
									},
									{
										order: 24,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'IMPACT', isCorrect: true }],
										},
									},
									{
										order: 25,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'WRITTEN REVIEW', isCorrect: true }],
										},
									},
									{
										order: 26,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: '(A) SEMINAR', isCorrect: true },
												{ key: 'A SEMINAR', isCorrect: true },
												{ key: 'SEMINAR', isCorrect: true },
											],
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
						},
						// Group 2: Table fill Q27–30
						{
							id: 's232',
							examId: '2',
							order: 2,
							contentType: SectionType.Question,
							directive: `<div><p><em>Complete the table below.</em><br/>
<em>Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</em></p>
<table><tbody>
<tr><td>Research projects using this database</td><td>Method</td><td>Year</td><td>Researcher</td></tr>
<tr><td>Digital Classrooms in Asia-Pacific: Connectivity and Learning Outcomes</td><td>____27____ (online)</td><td>____28____</td><td>Dr D. Wilson</td></tr>
<tr><td>Northern European Technology Integration Study</td><td>survey &amp; interviews</td><td>2014</td><td>Dr ____29____</td></tr>
<tr><td>School Improvement Through Digital Literacy</td><td>case studies</td><td>2010</td><td>Dr J. Firth</td></tr>
<tr><td>Technological Pedagogical Content Knowledge</td><td>practitioner observation</td><td>2019</td><td>Prof. A. Yuen</td></tr>
<tr><td>Technology and the Knowledge Society</td><td>literature review</td><td>2006</td><td>____30____</td></tr>
</tbody></table></div>`,
							questions: {
								create: [
									{
										order: 27,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'TOWER', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
									},
									{
										order: 28,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: '2008', isCorrect: true }],
										},
									},
									{
										order: 29,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'BROWN', isCorrect: true }],
										},
									},
									{
										order: 30,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'KNOWLEDGE POLICY', isCorrect: true }],
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
			},

			// ─────────────────────────────────────────────────────────────────
			// PART 4 — Immunology Lecture (Q31–40)
			// Group 1: Summary (Q31–37) | Group 2: Diagram (Q38–40)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's24',
				order: 4,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: Summary fill Q31–37
						{
							id: 's241',
							examId: '2',
							order: 1,
							contentType: SectionType.Question,
							directive: `<div><p><em>Complete the summary below.</em><br/>
<em>Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.</em></p>
<p><strong>Immunology</strong></p>
<p>Most people understand that the immune system ____31____ infection and disease, but few know how it works. The immune system recognises the cell proteins of the body and deals with any substance that might cause ____32____.</p>
<p>Most of the time our immune system is not ____33____. The ____34____ includes skin as well as organs and cells.</p>
<p>The white blood cells found in the ____35____ are part of the immune system and are central to its response to pathogens.</p>
<p>People became interested in the immune system after noticing that ____36____ seemed to pass on immunity. This led to further research and eventually a successful ____37____.</p></div>`,
							questions: {
								create: [
									{
										order: 31,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'ATTACKS', isCorrect: true }],
										},
										questionFiles: { create: [{ fileId: 'SYSTEM_sim_0104.mp3' }] },
										questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
									},
									{
										order: 32,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'ILLNESS', isCorrect: true },
												{ key: 'DISEASE', isCorrect: true },
											],
										},
									},
									{
										order: 33,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'ACTIVE', isCorrect: true }],
										},
									},
									{
										order: 34,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'DEFENCE', isCorrect: true },
												{ key: 'DEFENSE', isCorrect: true },
												{ key: 'IMMUNE SYSTEM', isCorrect: true },
											],
										},
									},
									{
										order: 35,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'BLOOD', isCorrect: true }],
										},
									},
									{
										order: 36,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'INFECTED COWS', isCorrect: true }],
										},
									},
									{
										order: 37,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'EXPERIMENT', isCorrect: true }],
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
						},
						// Group 2: Diagram label Q38–40
						{
							id: 's242',
							examId: '2',
							order: 2,
							contentType: SectionType.Question,
							directive: `<div><p><em>Label the diagram below.</em><br/>
<em>Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.</em></p>
<img src="SYSTEM_444c3d348da9908c25bbfb578d51c993a52b9854.jpg" alt="Immune response diagram"/></div>`,
							questions: {
								create: [
									{
										order: 38,
										content: `<p>____38____ (B-lymphocyte)</p>`,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'F', isCorrect: true }],
										},
										questionFiles: {
											create: [{ fileId: 'SYSTEM_444c3d348da9908c25bbfb578d51c993a52b9854.jpg' }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
									},
									{
										order: 39,
										content: '<p>____39____ (antibody)</p>',
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'A', isCorrect: true }],
										},
									},
									{
										order: 40,
										content: '<p>____40____ (antigen)</p>',
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'C', isCorrect: true }],
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Listening P1-4']) },
			},
		];
	}
}
