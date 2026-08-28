import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

export class GrammarVocabExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		return {
			id: '7',
			createdBy: 'admin',
			title: 'Grammar & Vocabulary Practice 1',
			duration: 45 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['Grammar', 'Vocabulary']),
					skipDuplicates: true,
				},
			},
			sections: {
				create: [
					{
						id: 's71',
						order: 1,
						name: 'Grammar',
						contentType: SectionType.Question,
						questions: {
							create: [
								{
									order: 1,
									content:
										'She _______________ to the meeting yesterday, but she was feeling unwell.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'could go', isCorrect: false },
											{ key: 'B', content: 'was supposed to go', isCorrect: true },
											{ key: 'C', content: 'must have gone', isCorrect: false },
											{ key: 'D', content: 'had to go', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Tenses']) },
								},
								{
									order: 2,
									content: 'Not until the manager arrived _______________ the meeting begin.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'did', isCorrect: true },
											{ key: 'B', content: 'was', isCorrect: false },
											{ key: 'C', content: 'had', isCorrect: false },
											{ key: 'D', content: 'would', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Tenses']) },
								},
								{
									order: 3,
									content:
										'The proposals _______________ by the committee before they are presented to the board.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'are reviewed', isCorrect: false },
											{ key: 'B', content: 'will be reviewed', isCorrect: true },
											{ key: 'C', content: 'have been reviewed', isCorrect: false },
											{ key: 'D', content: 'were reviewed', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Voice Active Passive']) },
								},
								{
									order: 4,
									content: 'If I _______________ about the traffic, I would have left earlier.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'know', isCorrect: false },
											{ key: 'B', content: 'knew', isCorrect: false },
											{ key: 'C', content: 'had known', isCorrect: true },
											{ key: 'D', content: 'would know', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Conditionals']) },
								},
								{
									order: 5,
									content:
										'The company is looking for someone _______________ is fluent in both English and Japanese.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'which', isCorrect: false },
											{ key: 'B', content: 'whom', isCorrect: false },
											{ key: 'C', content: 'who', isCorrect: true },
											{ key: 'D', content: 'whose', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Relative Clauses']) },
								},
								{
									order: 6,
									content: 'She studied hard _______________ pass the entrance examination.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'so that', isCorrect: false },
											{ key: 'B', content: 'in order to', isCorrect: true },
											{ key: 'C', content: 'so as', isCorrect: false },
											{ key: 'D', content: 'for', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Infinitives Gerunds']) },
								},
								{
									order: 7,
									content: 'The new policy is _______________ favourable than the previous one.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'less', isCorrect: true },
											{ key: 'B', content: 'least', isCorrect: false },
											{ key: 'C', content: 'more', isCorrect: false },
											{ key: 'D', content: 'most', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Comparisons']) },
								},
								{
									order: 8,
									content:
										'_______________ the difficulty of the task, the team completed it ahead of schedule.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'Despite', isCorrect: true },
											{ key: 'B', content: 'Because of', isCorrect: false },
											{ key: 'C', content: 'Although', isCorrect: false },
											{ key: 'D', content: 'However', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Prepositions Conjunctions']) },
								},
								{
									order: 9,
									content:
										'Either the director or the managers _______________ responsible for the final decision.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'is', isCorrect: false },
											{ key: 'B', content: 'are', isCorrect: true },
											{ key: 'C', content: 'has been', isCorrect: false },
											{ key: 'D', content: 'was', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Nouns Pronouns']) },
								},
								{
									order: 10,
									content: 'The report needs to be _______________ submitted by Friday.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'full', isCorrect: false },
											{ key: 'B', content: 'fully', isCorrect: true },
											{ key: 'C', content: 'filling', isCorrect: false },
											{ key: 'D', content: 'filled', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Adjectives Adverbs']) },
								},
							],
						},
					},
					{
						id: 's72',
						order: 2,
						name: 'Vocabulary',
						contentType: SectionType.Question,
						questions: {
							create: [
								{
									order: 11,
									content:
										'The two companies signed a _______________ to collaborate on the new project.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'contract', isCorrect: true },
											{ key: 'B', content: 'contact', isCorrect: false },
											{ key: 'C', content: 'contrast', isCorrect: false },
											{ key: 'D', content: 'content', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
								},
								{
									order: 12,
									content: 'The new employee quickly _______________ to the company culture.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'adopted', isCorrect: false },
											{ key: 'B', content: 'adapted', isCorrect: true },
											{ key: 'C', content: 'admitted', isCorrect: false },
											{ key: 'D', content: 'adhered', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Personnel HR']) },
								},
								{
									order: 13,
									content:
										'The marketing team launched a campaign to _______________ brand awareness among young consumers.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'rise', isCorrect: false },
											{ key: 'B', content: 'raise', isCorrect: true },
											{ key: 'C', content: 'arise', isCorrect: false },
											{ key: 'D', content: 'arouse', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Marketing Project']) },
								},
								{
									order: 14,
									content:
										'The package was _______________ to the wrong address due to a clerical error.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'delivered', isCorrect: true },
											{ key: 'B', content: 'delayed', isCorrect: false },
											{ key: 'C', content: 'denied', isCorrect: false },
											{ key: 'D', content: 'detained', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Shopping Delivery']) },
								},
								{
									order: 15,
									content:
										'Passengers are advised to _______________ at least two hours before departure.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'check in', isCorrect: true },
											{ key: 'B', content: 'checkout', isCorrect: false },
											{ key: 'C', content: 'check up', isCorrect: false },
											{ key: 'D', content: 'check over', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Transportation Housing']) },
								},
								{
									order: 16,
									content:
										'The research findings were published in a leading _______________ journal.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'academic', isCorrect: true },
											{ key: 'B', content: 'academy', isCorrect: false },
											{ key: 'C', content: 'academically', isCorrect: false },
											{ key: 'D', content: 'academia', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Academic Education']) },
								},
								{
									order: 17,
									content:
										'Scientists are developing new _______________ to combat antibiotic-resistant bacteria.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'treatments', isCorrect: true },
											{ key: 'B', content: 'treaties', isCorrect: false },
											{ key: 'C', content: 'tremors', isCorrect: false },
											{ key: 'D', content: 'traditions', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Science Technology']) },
								},
								{
									order: 18,
									content:
										'Regular exercise can significantly _______________ the risk of heart disease.',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'reduce', isCorrect: true },
											{ key: 'B', content: 'release', isCorrect: false },
											{ key: 'C', content: 'relieve', isCorrect: false },
											{ key: 'D', content: 'reproduce', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Health Environment']) },
								},
								{
									order: 19,
									content: 'The word "ubiquitous" is closest in meaning to',
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'rare', isCorrect: false },
											{ key: 'B', content: 'widespread', isCorrect: true },
											{ key: 'C', content: 'unique', isCorrect: false },
											{ key: 'D', content: 'temporary', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Synonym In Context']) },
								},
								{
									order: 20,
									content:
										"The company's _______________ to customer satisfaction is evident in its award-winning support team.",
									type: QuestionType.MultipleChoiceSingle,
									choices: {
										create: [
											{ key: 'A', content: 'contribution', isCorrect: false },
											{ key: 'B', content: 'commitment', isCorrect: true },
											{ key: 'C', content: 'commission', isCorrect: false },
											{ key: 'D', content: 'committee', isCorrect: false },
										],
									},
									questionTags: { create: this.tagNamesToIdInputs(['Business Office']) },
								},
							],
						},
					},
				],
			},
		};
	}
}
