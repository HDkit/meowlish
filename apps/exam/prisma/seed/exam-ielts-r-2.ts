import { ExamStatus } from '../../src/enums/exam-status.enum';
import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

// const PASSAGE_1 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
// <h2><strong>The Science of Laughter</strong></h2>
// <p>A. Laughter is a universal human behaviour that begins in infancy and continues throughout life. Babies begin to laugh at around three to four months of age, even before they can speak. This early emergence suggests that laughter is not a learned behaviour but rather an innate response that is wired into our biology. Indeed, laughter is observed across all human cultures and even has parallels in the animal kingdom, particularly among primates and rats, who emit ultrasonic vocalizations during play.</p>
// <p>B. Neuroscientific research has revealed that laughter involves a complex network of brain regions. The process begins in the prefrontal cortex, which interprets social and emotional context. From there, signals travel to the supplementary motor area, which coordinates the physical act of laughing—the contraction of facial muscles, changes in breathing patterns, and sometimes the production of vocal sounds. Simultaneously, the limbic system, particularly the amygdala and hippocampus, processes the emotional content, while the reward centres release dopamine, creating a feeling of pleasure.</p>
// <p>C. One of the most intriguing aspects of laughter is its social function. Studies show that people are approximately thirty times more likely to laugh when they are with others than when they are alone. Laughter serves as a social bonding mechanism, signalling friendliness and reducing tension within groups. Professor Robert Provine, a leading researcher in this field, has described laughter as a form of "social grooming" that helps maintain group cohesion. In conversation, laughter is rarely a response to a formal joke; instead, it punctuates everyday statements and serves to reinforce shared understanding.</p>
// <p>D. The health benefits of laughter have been well documented. Research indicates that laughter can lower blood pressure, reduce stress hormones such as cortisol, and boost the immune system by increasing the production of antibodies and activating T-cells. Laughter also triggers the release of endorphins, the body's natural painkillers, which is why "laughter therapy" or "laughter yoga" has gained popularity as a complementary treatment for various conditions. A study conducted at the University of Oxford found that the pain threshold of participants increased significantly after watching comedy videos compared to those who watched neutral content.</p>
// <p>E. Laughter yoga was pioneered by Dr Madan Kataria in Mumbai, India, in 1995. The practice combines voluntary laughter exercises with yogic breathing techniques. Participants engage in simulated laughter—often initiated through eye contact and playful activities—which quickly becomes genuine and contagious. Today there are over 5,000 laughter yoga clubs in more than 60 countries. While some medical professionals remain sceptical about its therapeutic claims, participants report improved mood, reduced anxiety, and a greater sense of connection with others.</p>
// <p>F. Despite decades of research, the fundamental question of why we laugh remains partly unanswered. The leading theory, known as the "incongruity theory," proposes that laughter occurs when we encounter something unexpected that violates our mental patterns, but in a safe or non-threatening context. Other theories emphasize the role of laughter in signalling relief from tension or as a display of playfulness. What is clear is that laughter is far more than a simple response to humour—it is a complex, multifaceted behaviour that plays a crucial role in human social life and well-being.</p>
// </div></div></div>`;

// const PASSAGE_2 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
// <h2><strong>Urban Farming: Cultivating the City</strong></h2>
// <p>As the global population becomes increasingly urbanized, with more than half of the world's people now living in cities, the question of how to feed urban dwellers sustainably has become pressing. Urban farming the practice of cultivating, processing, and distributing food in or around urban areas, has emerged as one answer to this challenge. From rooftop gardens to vertical farms, urban agriculture is transforming the way city residents think about food.</p>
// <p>The concept is not new. During World War II, "victory gardens" in the United States and the United Kingdom produced up to 40 percent of the fresh vegetables consumed domestically. In contemporary Havana, Cuba, urban gardens emerged as a necessity during the economic crisis of the 1990s and now supply a substantial portion of the city's fresh produce. Similarly, Detroit, Michigan has witnessed a resurgence of urban agriculture as a response to economic decline, with vacant lots being converted into community gardens that provide fresh food in areas where supermarkets are scarce.</p>
// <p>Technological innovation has expanded the possibilities of urban farming considerably. Vertical farming, pioneered by Dr Dickson Despommier of Columbia University, involves growing crops in stacked layers within controlled-environment buildings. These facilities use LED lighting, hydroponic or aeroponic systems, and climate control technology to optimize growing conditions year-round. Proponents argue that vertical farming uses 95 percent less water than conventional agriculture, eliminates the need for pesticides, and reduces the carbon footprint associated with transporting food from rural farms to urban markets.</p>
// <p>However, critics point out that vertical farms remain energy-intensive due to their reliance on artificial lighting. A 2015 study estimated that the energy cost of lighting alone could make vertical farming economically unviable for staple crops such as wheat and rice. Nevertheless, the technology shows promise for high-value, perishable crops such as leafy greens, herbs, and certain vegetables, which currently account for the majority of vertically farmed products.</p>
// <p>Community gardens offer a less technologically intensive alternative. These shared spaces, often managed by neighbourhood associations, provide not only fresh produce but also social benefits. Studies have shown that residents living near community gardens report higher levels of neighbourhood satisfaction and are more likely to engage in other forms of civic participation. Children who participate in school gardening programs demonstrate increased willingness to try fruits and vegetables, suggesting that urban agriculture can also improve public health outcomes.</p>
// <p>The future of urban farming will likely involve a combination of approaches. While high-tech vertical farms may supply certain crops to supermarkets and restaurants, community gardens and rooftop plots will continue to serve local neighbourhoods. Policy support will be crucial: cities such as Singapore have integrated urban farming into their national food security strategy, offering grants and technical assistance to urban farmers. As climate change threatens traditional agricultural systems, the resilience offered by distributed, local food production may become increasingly valuable.</p>
// </div></div></div>`;

// const PASSAGE_3 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
// <h2><strong>Artificial Intelligence in Healthcare</strong></h2>
// <p>Artificial intelligence is rapidly transforming the healthcare industry, offering new possibilities for diagnosis, treatment planning, and patient care. Machine learning algorithms can analyse medical images with accuracy that rivals or exceeds that of human specialists, while natural language processing systems can extract relevant information from patient records to support clinical decision-making.</p>
// <p>In radiology, AI systems have demonstrated remarkable capabilities. A deep learning model developed by Google Health was able to detect breast cancer in mammograms with fewer false positives and false negatives than human radiologists in a 2020 study published in Nature. Similarly, algorithms for detecting lung nodules, retinal disease, and skin cancer have achieved performance levels comparable to or better than expert clinicians. These systems do not tire, can process thousands of images in a short time, and can be deployed in underserved areas where specialist radiologists are scarce.</p>
// <p>Beyond imaging, AI is being applied to drug discovery, where it can dramatically accelerate the process of identifying potential therapeutic compounds. Traditional drug development typically takes ten to fifteen years and costs billions of dollars. AI models can screen millions of chemical compounds in silico, predicting their likely efficacy and safety profile before any laboratory testing begins. During the COVID-19 pandemic, AI-driven platforms were used to identify existing drugs that might be repurposed for treating the disease, significantly shortening the research timeline.</p>
// <p>Despite these advances, significant challenges remain. AI systems require large, high-quality datasets for training, and healthcare data is often fragmented, incomplete, or biased. A diagnostic algorithm trained predominantly on data from one demographic group may perform poorly when applied to another, raising concerns about health equity. Furthermore, the "black box" nature of some AI models makes it difficult for clinicians to understand how a particular conclusion was reached, creating barriers to adoption in a field that values transparency and accountability.</p>
// <p>Regulatory frameworks are still catching up with the technology. In the United States, the Food and Drug Administration has approved a growing number of AI-enabled medical devices, but questions remain about how to monitor their performance over time and who is liable when an AI system makes an error. The European Union's proposed AI regulation categorizes medical AI as "high-risk," subjecting it to strict requirements for transparency, human oversight, and robustness.</p>
// <p>Looking ahead, the most promising applications of AI in healthcare may not be those that replace human clinicians but those that augment their capabilities. An AI system might flag suspicious areas on a scan for a radiologist to review, suggest possible diagnoses based on a patient's symptoms and history, or help a surgeon plan a complex procedure with greater precision. The goal, many experts argue, should be a partnership between human expertise and machine intelligence, combining the best of both to improve patient outcomes.</p>
// </div></div></div>`;

const P1_INSTRUCTION = `<div><p><em>Reading Passage 1 has six sections, A-F.</em><br/>
<em>Choose the correct heading for each section from the list of headings below.</em><br/>
<em>Write the correct number, i-ix, in boxes 1-6 on your answer sheet.</em></p>
<p><strong>List of Headings</strong></p>
<p>i. The biological basis of laughter<br/>
ii. Physical and psychological benefits<br/>
iii. Laughter as a social tool<br/>
iv. The global spread of laughter yoga<br/>
v. Early development of laughter in infants<br/>
vi. Remaining mysteries<br/>
vii. Brain mechanisms underlying laughter<br/>
viii. Laughter across species<br/>
ix. An Indian innovation</p></div>`;

const P2_INSTRUCTION = `<div><p><em>Do the following statements agree with the information given in Reading Passage 2?</em><br/>
<em>In boxes 7-14 on your answer sheet, write</em><br/>
<em><strong>TRUE</strong> if the statement agrees with the information</em><br/>
<em><strong>FALSE</strong> if the statement contradicts the information</em><br/>
<em><strong>NOT GIVEN</strong> if there is no information on this</em></p></div>`;

const P3_INSTRUCTION = `<div><p><em>Complete the sentences below.</em><br/>
<em>Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</em><br/>
<em>Write your answers in boxes 15-22 on your answer sheet.</em></p></div>`;

export class IeltsR2ExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		const sections = this.buildSections();
		return {
			id: '6',
			createdBy: 'admin',
			title: 'IELTS R 2',
			duration: 60 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['IELTS Reading P1-3']),
					skipDuplicates: true,
				},
			},
			sections: { create: sections },
		};
	}

	private buildSections(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// Passage 1 — The Science of Laughter (Q1-6)
			{
				id: 's61',
				order: 1,
				name: 'The Science of Laughter',
				directive: P1_INSTRUCTION,
				contentType: SectionType.Question,
				questions: {
					create: [
						{
							order: 1,
							content: 'Section A',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: false },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: false },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: true,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: false },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: false },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
						{
							order: 2,
							content: 'Section B',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: false },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: false },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: false,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: false },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: true },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
						{
							order: 3,
							content: 'Section C',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: false },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: true },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: false,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: false },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: false },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
						{
							order: 4,
							content: 'Section D',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: true },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: false },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: false,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: false },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: false },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
						{
							order: 5,
							content: 'Section E',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: false },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: false },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: false,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: false },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: false },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
						{
							order: 6,
							content: 'Section F',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'i', content: 'The biological basis of laughter', isCorrect: false },
									{ key: 'ii', content: 'Physical and psychological benefits', isCorrect: false },
									{ key: 'iii', content: 'Laughter as a social tool', isCorrect: false },
									{ key: 'iv', content: 'The global spread of laughter yoga', isCorrect: false },
									{
										key: 'v',
										content: 'Early development of laughter in infants',
										isCorrect: false,
									},
									{ key: 'vi', content: 'Remaining mysteries', isCorrect: true },
									{ key: 'vii', content: 'Brain mechanisms underlying laughter', isCorrect: false },
									{ key: 'viii', content: 'Laughter across species', isCorrect: false },
									{ key: 'ix', content: 'An Indian innovation', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
						},
					],
				},
			},
			// Passage 2 — Urban Farming (Q7-14)
			{
				id: 's62',
				order: 2,
				name: 'Urban Farming: Cultivating the City',
				directive: P2_INSTRUCTION,
				contentType: SectionType.Question,
				questions: {
					create: [
						{
							order: 7,
							content:
								'During World War II, urban agriculture supplied nearly half of all vegetables eaten in some countries.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: true },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
						},
						{
							order: 8,
							content: 'Urban farming in Havana began as a government initiative.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: false },
									{ key: 'B', content: 'FALSE', isCorrect: true },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
						},
						{
							order: 9,
							content: 'Vertical farming was first proposed in the early 2000s.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: false },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
						},
						{
							order: 10,
							content:
								'Vertical farming uses significantly less water than traditional farming methods.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: true },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
						},
						{
							order: 11,
							content: 'Vertical farms are more energy-efficient than greenhouses.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: false },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
						},
						{
							order: 12,
							content:
								'Vertical farming is currently most suited to growing certain types of crops.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: true },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 13,
							content:
								'Children who participate in school gardens are more likely to eat healthily.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: true },
									{ key: 'B', content: 'FALSE', isCorrect: false },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 14,
							content: 'Singapore is the only Asian city with a policy to support urban farming.',
							type: QuestionType.MultipleChoiceSingle,
							choices: {
								create: [
									{ key: 'A', content: 'TRUE', isCorrect: false },
									{ key: 'B', content: 'FALSE', isCorrect: true },
									{ key: 'C', content: 'NOT GIVEN', isCorrect: false },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
					],
				},
			},
			// Passage 3 — AI in Healthcare (Q15-22)
			{
				id: 's63',
				order: 3,
				name: 'Artificial Intelligence in Healthcare',
				directive: P3_INSTRUCTION,
				contentType: SectionType.Question,
				questions: {
					create: [
						{
							order: 15,
							content:
								'AI systems can analyse _______________ with accuracy comparable to human specialists.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'medical images', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 16,
							content:
								"A study published in _______________ showed that Google Health's AI could detect breast cancer effectively.",
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'Nature', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 17,
							content:
								'AI can screen millions of chemical compounds _______________, predicting their efficacy and safety.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'in silico', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 18,
							content: 'Traditional drug development typically takes ten to _______________ years.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [
									{ key: 'fifteen', isCorrect: true },
									{ key: '15', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 19,
							content: 'Healthcare data is often fragmented, incomplete, or _______________.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'biased', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 20,
							content:
								'The "_______________" nature of some AI models creates barriers to adoption in healthcare.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'black box', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 21,
							content: "The EU's proposed AI regulation categorizes medical AI as _______________.",
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [
									{ key: 'high-risk', isCorrect: true },
									{ key: '"high-risk"', isCorrect: true },
									{ key: 'high risk', isCorrect: true },
								],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
						{
							order: 22,
							content:
								'The most promising future for AI in healthcare is as a _______________ with human clinicians.',
							type: QuestionType.FillExactInTheBlank,
							choices: {
								create: [{ key: 'partnership', isCorrect: true }],
							},
							questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
						},
					],
				},
			},
		];
	}
}
