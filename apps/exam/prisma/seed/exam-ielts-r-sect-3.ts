import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

// ─── Passage 3 text ───────────────────────────────────────────────────────────
const PASSAGE_3 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
<h2><strong>Does water have memory?</strong></h2>
<p>The practice of homeopathy was first developed by the German physician Samuel Hahnemann. During research in the 1790s, Hahnemann began experimenting with quinine, an alkaloid derived from cinchona bark that was well known at the time to have a positive effect on fever. Hahnemann started dosing himself with quinine while in a state of good health, and reported in his journals that his extremities went cold, he experienced palpitations, an 'infinite anxiety', a trembling and weakening of the limbs, reddening cheeks and thirst—'in short', he concluded, 'all the symptoms of relapsing fever presented themselves successively...' Hahnemann's main observation was that things which create problems for healthy people cure those problems in sick people, and this became his first principle of homeopathy: <em>simila similibus</em> (with help from the same). While diverging from the principle of apothecary practice at the time—which was <em>contraria contrariis</em> (with help from the opposite)—the efficacy of <em>simila similibus</em> was reaffirmed by subsequent developments in the field of vaccinations.</p>
<p>Hahnemann's second principle was minimal dosing—treatments should be taken in the most diluted form at which they remain effective. This negated any possible toxic effects of <em>simila similibus</em>. In 1988 the French immunologist Jacques Benveniste took minimal dosing to new extremes when he published a paper in the prestigious scientific journal <em>Nature</em> in which he suggested that very high dilutions of the anti-lgE antibody could affect human basophil granulocytes, the least common of the granulocytes that make up about 0.01% to 0.3% of white blood cells. The point of controversy, however, was that the water in Benveniste's test had been so diluted that any molecular evidence of the antibodies no longer existed. Water molecules, the researcher concluded, had a biologically active component that a journalist later termed 'water memory'. A number of efforts from scientists in Britain, France and the Netherlands to duplicate Benveniste's research were unsuccessful, however, and to this day no peer-reviewed study under broadly accepted conditions has been able to confirm the validity of 'water memory'.</p>
<p>The third principle of homeopathy is 'the single remedy'. Exponents of this principle believe that it would be too difficult, if not impossible, to ascertain the potential effects of multiple homeopathic remedies delivered simultaneously. If it did work, they suggest, one could not know quite why it worked, turning homeopathy into an ambiguous guessing game. If it did not work, neither patient nor practitioner would know whether the ingredients were all ineffective, or whether they were only ineffective in combination with one another. Combination remedies are gaining in popularity, but classical homeopaths who rely on the single remedy approach warn these are not more potent, nor do they provide more treatment options. The availability of combination remedies, these homeopaths suggest, has been led by consumers wanting more options, not from homeopathic research indicating their efficacy.</p>
<p>Homeopathy is an extremely contentious form of medicine, with strong assertions coming from both critics and supporters of the practice. 'Homeopathy: There's nothing in it' announces the tagline to 10:23, a major British anti-homeopathy campaign. At 10.23 a.m. on 30 January 2010, over 400 supporters of the 10:23 stood outside Boots pharmacies and swallowed an entire bottle each of homeopathic pills in an attempt to raise awareness about the fact that these remedies are made of sugar and water, with no active components. This, defenders of homeopathy say, is entirely the point. Homeopathic products do not rely on ingredients that become toxic at high doses, because the water retains the 'memory' that allows the original treatment to function.</p>
<p>Critics also point out the fact that homeopathic preparations have no systematic design to them, making it hard to monitor whether or not a particular treatment has been efficacious. Homeopaths embrace this uncertainty. While results may be less certain, they argue, the non-toxic nature of homeopathy means that practitioner and patient can experiment until they find something that works without concern for side effects. Traditional medicine, they argue, assaults the body with a cocktail of drugs that only tackles the symptoms of disease, while homeopathy has its sights aimed on the causes.</p>
<p>Homeopaths suggest this approach leads to kinder, gentler, more effective treatment. Finally, critics allege that when homeopathy has produced good results, these are exceedingly dependent on the placebo effect, and cannot justify the resources, time and expense that the homeopathic tradition absorbs. The placebo effect is a term that describes beneficial outcomes from a treatment than can be attributed to the patient's expectations concerning the treatment rather than from the treatment itself. Basically, the patient 'thinks' himself into feeling better. Defenders suggest that homeopathy can go beyond this psychological level. They point to the successful results of homeopathy on patients who are unconscious at the time of treatment, as well as on animals.</p>
</div></div></div>`;

// ─── Group instructions ───────────────────────────────────────────────────────
const P3_G1_INSTRUCTION = `<div><p><em>Complete each sentence with the correct ending, A-K, below.</em><br/>
<em>Write the correct letter, A-K, in boxes 27-32 on your answer sheet.</em><br/>
A. avoid the unpredictable outcomes of combining many remedies at once.<br/>
B. explain the success of 18th century apothecary medicine.<br/>
C. produce fever-like symptoms in a healthy person.<br/>
D. keep antibody molecules active in parts as low as 0.01%.<br/>
E. support the notion of <em>simila similibus</em>.<br/>
F. offer more remedial choice.<br/>
G. produce a less effective dose.<br/>
H. recreate the original results.<br/>
I. retain qualities of an antibody to which they were previously exposed.<br/>
J. satisfy the demand of buyers.<br/>
K. treat effectively someone with a fever.</p></div>`;

const P3_G2_INSTRUCTION = `<div><p><em>Complete the table below.</em><br/>
<em>Choose <strong>NO MORE THAN TWO WORDS</strong> from the text for each answer.</em><br/>
<em>Write your answers in boxes 33-40 on your answer sheet.</em></p>
<table><tbody>
<tr><td><strong>Arguments against homeopathy</strong></td><td><strong>Arguments for homeopathy</strong></td></tr>
<tr><td>Has no ____33____ ingredients.</td><td>Does not become ____34____ when taken in large quantities.</td></tr>
<tr><td>Lack of a ____35____ makes success or failure of treatments difficult to ____36____</td><td>Remedies can be trialed with no risk of ____37____; treatments tackle causes and not just ____38____.</td></tr>
<tr><td>Too much reliance on the ____39____. Works psychologically but not physically.</td><td>Proven to work on people who are ____40____.</td></tr>
</tbody></table></div>`;

export class IeltsRExamSect3Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PASSAGE 3 — Does water have memory? (Q27–40)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's33',
				order: 3,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: Sentence completion matching Q27–32
						{
							id: 's331',
							examId: '3',
							order: 1,
							contentType: SectionType.Question,
							directive: PASSAGE_3 + P3_G1_INSTRUCTION,
							questions: {
								create: [
									{
										order: 27,
										content:
											'<p>In the late 18th century, Hahnemann discovered that quinine was able to</p>',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'C', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['IELTS Reading P1-3', 'Text Completion']),
										},
									},
									{
										order: 28,
										content: 'The effectiveness of vaccinations also helps to',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'E', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 29,
										content:
											'Benveniste argued in the journal Nature that water molecules possess the ability to',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'I', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 30,
										content: "Attempts to verify Benveniste's findings were unable to",
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'H', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 31,
										content: 'The purpose of the single remedy is to',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'A', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
									{
										order: 32,
										content:
											'Classical homeopaths suggest combination remedies have been created to',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'J', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Text Completion']) },
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
						},
						// Group 2: Table fill Q33–40
						{
							id: 's332',
							examId: '3',
							order: 2,
							contentType: SectionType.Question,
							directive: P3_G2_INSTRUCTION,
							questions: {
								create: [
									{
										order: 33,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'ACTIVE', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs([
												'IELTS Reading P1-3',
												'Detail Information',
												'Form Schedule List',
											]),
										},
									},
									{
										order: 34,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'TOXIC', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 35,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'SYSTEMATIC DESIGN', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 36,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'MONITOR', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 37,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'SIDE-EFFECTS', isCorrect: true },
												{ key: 'SIDE EFFECTS', isCorrect: true },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 38,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'SYMPTOMS', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 39,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'PLACEBO EFFECT', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 40,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [{ key: 'UNCONSCIOUS', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
			},
		];
	}
}
