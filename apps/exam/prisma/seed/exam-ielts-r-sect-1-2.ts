import { QuestionType } from '../../src/enums/question-type.enum';
import { SectionType } from '../../src/enums/section-type.enum';
import { Prisma } from '@prisma-client/exam';

// ─── Passage texts ────────────────────────────────────────────────────────────
const PASSAGE_1 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
<h2><strong>A disaster of Titanic proportions</strong></h2>
<p>At 11.39 p.m. on the evening of Sunday 14 April 1912, lookouts Frederick Fleet and Reginald Lee on the forward mast of the <em>Titanic</em> sighted an eerie, black mass coming into view directly in front of the ship. Fleet picked up the phone to the helm, waited for Sixth Officer Moody to answer, and yelled 'Iceberg, right ahead!' The greatest disaster in maritime history was about to be set in motion.</p>
<p>Thirty-seven seconds later, despite the efforts of officers in the bridge and engine room to steer around the iceberg, the <em>Titanic</em> struck a piece of submerged ice, bursting rivets in the ship's hull and flooding the first five watertight compartments. The ship's designer, Thomas Andrews, carried out a visual inspection of the ship's damage and informed Captain Smith at midnight that the ship would sink in less than two hours. By 12.30 a.m., the lifeboats were being filled with women and children, after Smith had given the command for them to be uncovered and swung out 15 minutes earlier. The first lifeboat was successfully lowered 15 minutes later, with only 28 of its 65 seats occupied. By 1.15 a.m., the waterline was beginning to reach the <em>Titanic</em>'s name on the ship's bow, and over the next hour every lifeboat would be released as officers struggled to maintain order amongst the growing panic on board.</p>
<p>The closing moments of the <em>Titanic</em>'s sinking began shortly after 2 a.m., as the last lifeboat was lowered and the ship's propellers lifted out of the water, leaving the 1,500 passengers still on board to surge towards the stern. At 2.17 a.m., Harold Bride and Jack Philips tapped out their last wireless message after being relieved of duty as the ship's wireless operators, and the ship's band stopped playing. Less than a minute later, occupants of the lifeboats witnessed the ship's lights flash once, then go black, and a huge roar signalled the <em>Titanic</em>'s contents plunging towards the bow, causing the front half of the ship to break off and go under. The <em>Titanic</em>'s stern bobbed up momentarily, and at 2.20 a.m., the ship finally disappeared beneath the frigid waters.</p>
<p>What or who was responsible for the scale of this catastrophe? Explanations abound, some that focus on very small details. Due to a last minute change in the ship's officer line-up, iceberg lookouts Frederick Fleet and Reginald Lee were making do without a pair of binoculars that an officer transferred off the ship in Southampton had left in a cupboard onboard, unbeknownst to any of the ship's crew. Fleet, who survived the sinking, insisted at a subsequent inquiry that he could have identified the iceberg in time to avert disaster if he had been in possession of the binoculars.</p>
<p>Less than an hour before the <em>Titanic</em> struck the iceberg, wireless operator Cyril Evans on the <em>Californian</em>, located just 20 miles to the north, tried to contact operator Jack Philips on the <em>Titanic</em> to warn him of pack ice in the area. 'Shut up, shut up, you're jamming my signal', Philips replied. 'I'm busy.' The <em>Titanic</em>'s wireless system had broken down for several hours earlier that day, and Philips was clearing a backlog of personal messages that passengers had requested to be sent to family and friends in the USA. Nevertheless, Captain Smith had maintained the ship's speed of 22 knots despite multiple earlier warnings of ice ahead. It has been suggested that Smith was under pressure to make headlines by arriving early in New York, but maritime historians such as Richard Howell have countered this perception, noting that Smith was simply following common procedure at the time, and not behaving recklessly.</p>
<p>One of the strongest explanations for the severe loss of life has been the fact that the <em>Titanic</em> did not carry enough lifeboats for everyone on board. Maritime regulations at the time tied lifeboat capacity to ship size, not to the number of passengers on board. This meant that the <em>Titanic</em>, with room for 1,178 of its 2,222 passengers, actually surpassed the Board of Trade's requirement that it carry lifeboats for 1,060 of its passengers. Nevertheless, with lifeboats being lowered less than half full in many cases, and only 712 passengers surviving despite a two and a half hour window of opportunity, more lifeboats would not have guaranteed more survivors in the absence of better training and preparation. Many passengers were confused about where to go after the order to launch lifeboats was given; a lifeboat drill scheduled for earlier on the same day that the Titanic struck the iceberg was cancelled by Captain Smith, in order to allow passengers to attend church.</p>
</div></div></div>`;

const PASSAGE_2 = `<div class="context-wrapper"><div class="context-content text-highlightable"><div>
<h2><strong>Three dimensional films</strong></h2>
<p>A. In the theatre of the Ambassador Hotel in Los Angeles, on the evening of 27 September 1922, a new form of film-making made its commercial debut: 3-D. The film, <em>The Power of Love</em>, was then shown in New York City to exhibitors and press, but was subsequently not picked up for distribution and is now believed to be lost. The following three decades were a period of quiet experimentation for 3-D pioneers, as they adapted to new technologies and steadily improved the viewing experience. In 1952 the 'golden era' of 3-D is considered to have begun with the release of <em>Bwana Devil</em>, and over the next several years audiences met with a string of films that used the technology. Over the following decades it waxed and waned within film-making circles, peaking in the 1970s and again in the 1990s when IMAX gained traction, but it is only in the last few years that 3-D appears to have firmly entered mainstream production.</p>
<p>B. Released worldwide in December 2009, the fantasy film <em>Avatar</em> quickly became the highest-grossing film ever made, knocking <em>Titanic</em> from the top slot. <em>Avatar</em>, set in 2154 on a planet in a distant solar system, went on to become the only film to have earned US$2 billion world-wide, and is now approaching the $3 billion mark. The main reason for its runaway popularity appears to be its visual splendour; though most critics praised the film, it was mostly on account of its ground-breaking special effects. Kenneth Turan of the <em>Los Angeles Times</em> praised <em>Avatar</em>'s 'powerful' visual accomplishments, but suggested the dialogue was 'flat' and the characterisations 'obvious'. A film analyst at Exhibitor Relations has agreed, noting that <em>Avatar</em> has cemented the use of 3-D as a production and promotional tool for blockbuster films, rather than as a mere niche or novelty experiment. 'This is why all these 3-D venues were built', he said. 'This is the one. The behemoth... The holy grail of 3-D has finally arrived'.</p>
<p>C. Those who embrace 3-D note that it spices up a trip to the cinema by adding a more active 'embodied' layer of experience instead of the viewer passively receiving the film through eyes and ears only. A blogger on Animation Ideas writes, '...when 3-D is done well—like in the flying scenes in <em>Up</em>, <em>How to Train Your Dragon</em> and <em>Avatar</em>, there is an added feeling of vertigo. If you have any fear of heights, the 3-D really adds to this element...' Kevin Carr argues that the backlash against 3-D is similar to that which occurred against CGI several years ago, and points out that CGI is now widely regarded as part of the film-maker's artistic toolkit. He also notes that new technology is frequently seen to be a 'gimmick' in its early days, pointing out that many commentators slapped the first 'talkie' films of the early 1920s with this same label.</p>
<p>D. But not everyone greets the rise of 3-D with open arms. Some ophthalmologists point out that 3-D can have unsettling physical effects for many viewers. Dr. Michael Rosenberg, a professor at Northwestern University, has pointed out that many people go through life with minor eye disturbances—a slight muscular imbalance, for example—that does not interrupt day-to-day activities. In the experience of a 3-D movie, however, this problem can be exacerbated through the viewer trying to concentrate on unusual visual phenomena. Dr. Deborah Friedman, from the University of Rochester Medical Center, notes that the perception of depth conjured through three dimensions does not complement the angles from which we take in the world. Eyestrains, headaches and nausea are therefore a problem for around 15% of a 3-D film audience.</p>
<p>E. Film critic Roger Ebert warns that 3-D is detrimental to good film-making. Firstly, he argues, the technology is simply unnecessary; 2-D movies are 'already' 3-D, as far as our minds are concerned. Adding the extra dimension with technology, instead of letting our minds do the work, can actually be counter-purposeful and make the over-all effect seem clumsy and contrived. Ebert also points out that the special glasses dim the effect by soaking up light from the screen, making 3-D films a slightly duller experience than they might otherwise be. Finally, Ebert suggests that 3-D encourages film-makers to undercut drama and narrative in favour of simply piling on more gimmicks and special effects. 'Hollywood is racing headlong toward the kiddie market,' he says, pointing to Disney's announcement that it will no longer make traditional films in favour of animation, franchises, and superheroes.</p>
<p>F. Whether or not 3-D becomes a powerful force for the film-maker's vision and the film-going experience, or goes down in history as an over-hyped, expensive novelty, the technology certainly shows no signs of fading in the popularity stakes at the moment. <em>Clash of the Titans</em>, <em>Alice in Wonderland</em> and <em>How to Train Your Dragon</em> have all recently benefited at the box office due to the added sales that 3-D provides, and with <em>Avatar</em>'s record set to last some time as a totem of 3-D's commercial possibilities, studios are not prepared to back down.</p>
</div></div></div>`;

// ─── Group instructions ───────────────────────────────────────────────────────
const P1_G1_INSTRUCTION = `<div><p><em>Complete the table below.</em><br/>
<em>Choose <strong>NO MORE THAN TWO WORDS</strong> from the text for each answer.</em><br/>
<em>Write your answers in boxes 1-6 on your answer sheet.</em></p>
<table><tbody>
<tr><td>Time</td><td>Person/s</td><td>Position</td><td>Action</td></tr>
<tr><td>11.39 p.m.</td><td>____1____</td><td>____2____</td><td>Reported sighting of iceberg</td></tr>
<tr><td>____3____</td><td>Andrews</td><td>Ship's designer</td><td>Reported how long the <em>Titanic</em> could stay afloat</td></tr>
<tr><td>12.15 a.m.</td><td>Smith</td><td>Captain</td><td>Ordered ____4____ to be released</td></tr>
<tr><td>2.17 a.m.</td><td>Bride &amp; Philips</td><td>____5____</td><td>Relayed final ____6____</td></tr>
</tbody></table></div>`;

const P1_G2_INSTRUCTION = `<div><p><em>Do the following statements agree with the information given in Reading Passage 1?</em><br/>
<em>In boxes 7-13 on your answer sheet, write</em><br/>
<em><strong>TRUE</strong> if the statement agrees with the information</em><br/>
<em><strong>FALSE</strong> if the statement contradicts the information</em><br/>
<em><strong>NOT GIVEN</strong> if there is no information on this</em></p></div>`;

const P2_G1_INSTRUCTION = `<div><p><em>Reading Passage 2 has six sections, A-F.</em><br/>
<em>Choose the correct headings for sections A-F from the list of headings below.</em><br/>
<em>Write the correct number, i-x, in boxes 14-19 on your answer sheet.</em></p>
<p><strong>List of Headings</strong></p>
<p>i. Construction of special cinemas for 3-D<br/>
ii. Good returns forecast for immediate future<br/>
iii. The greatest 3-D film of all time<br/>
iv. End of traditional movies for children<br/>
v. Early developments<br/>
vi. New technology diminishes the art<br/>
vii. The golden age of movies<br/>
viii. In defence of 3-D<br/>
ix. 3-D is here to stay<br/>
x. Undesirable visual effects</p></div>`;

const P2_G2_INSTRUCTION = `<div><p><em>Look at the following statements (Questions 20-26) and the list of people below.</em><br/>
<em>Match each statement with the correct person, A-G.</em><br/>
<em>Write the correct letter, A-G, in boxes 20-26 on your answer sheet.</em><br/>
<em><strong>NB</strong> You may use any letter more than once.</em></p>
<p><strong>List of People</strong><br/>
A. Kenneth Turan<br/>
B. Exhibitor Relations' analyst<br/>
C. Animation Ideas' blogger<br/>
D. Kevin Carr<br/>
E. Dr Michael Rosenberg<br/>
F. Dr Deborah Friedman<br/>
G. Roger Ebert</p></div>`;

export class IeltsRExamSect12Seeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.SectionCreateWithoutExamInput[] {
		return [
			// ─────────────────────────────────────────────────────────────────
			// PASSAGE 1 — A disaster of Titanic proportions (Q1–13)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's31',
				order: 1,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: Table fill Q1–6
						{
							id: 's311',
							examId: '3',
							order: 1,
							contentType: SectionType.Question,
							directive: PASSAGE_1 + P1_G1_INSTRUCTION,
							questions: {
								create: [
									{
										order: 1,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'FREDERICK FLEET', isCorrect: true },
												{ key: 'FLEET', isCorrect: true },
											],
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
										order: 2,
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'LOOKOUT', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 3,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'MIDNIGHT', isCorrect: true },
												{ key: '12.00 A.M.', isCorrect: true },
												{ key: '12.00 AM', isCorrect: true },
												{ key: '12 A.M.', isCorrect: true },
												{ key: '12 AM', isCorrect: true },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 4,
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'LIFEBOATS', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 5,
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'WIRELESS OPERATORS', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
									{
										order: 6,
										type: QuestionType.FillAnyInTheBlank,
										choices: {
											create: [
												{ key: 'WIRELESS MESSAGE', isCorrect: true },
												{ key: 'MESSAGE', isCorrect: true },
											],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['Detail Information', 'Form Schedule List']),
										},
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
						},
						// Group 2: TRUE / FALSE / NOT GIVEN Q7–13
						{
							id: 's312',
							examId: '3',
							order: 2,
							contentType: SectionType.Question,
							directive: P1_G2_INSTRUCTION,
							questions: {
								create: [
									{
										order: 7,
										content:
											'<p>The binoculars for the men on watch had been left in a crew locker in Southampton.</p>',
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: false },
												{ key: 'FALSE', content: 'FALSE', isCorrect: true },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: false },
											],
										},
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 8,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: false },
												{ key: 'FALSE', content: 'FALSE', isCorrect: false },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: true },
											],
										},
										content:
											'The missing binoculars were the major factor leading to the collision with the iceberg.',
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 9,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: false },
												{ key: 'FALSE', content: 'FALSE', isCorrect: true },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: false },
											],
										},
										content:
											"Philips missed notification about the ice from Evans because the Titanic's wireless system was not functioning at the time.",
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 10,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: true },
												{ key: 'FALSE', content: 'FALSE', isCorrect: false },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: false },
											],
										},
										content: 'Captain Smith knew there was ice in the area.',
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 11,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: false },
												{ key: 'FALSE', content: 'FALSE', isCorrect: true },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: false },
											],
										},
										content:
											"Howell believed the captain's failure to reduce speed was an irresponsible action.",
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 12,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: true },
												{ key: 'FALSE', content: 'FALSE', isCorrect: false },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: false },
											],
										},
										content:
											'The Titanic was able to seat more passengers in lifeboats than the Board of Trade required.',
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
									{
										order: 13,
										type: QuestionType.MultipleChoiceSingle,
										choices: {
											create: [
												{ key: 'TRUE', content: 'TRUE', isCorrect: false },
												{ key: 'FALSE', content: 'FALSE', isCorrect: false },
												{ key: 'NOT GIVEN', content: 'NOT GIVEN', isCorrect: true },
											],
										},
										content: 'A lifeboat drill would have saved more lives.',
										questionTags: { create: this.tagNamesToIdInputs(['True False NG']) },
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
						},
					],
				},
				sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
			},

			// ─────────────────────────────────────────────────────────────────
			// PASSAGE 2 — Three dimensional films (Q14–26)
			// ─────────────────────────────────────────────────────────────────
			{
				id: 's32',
				order: 2,
				contentType: SectionType.Section,
				childSections: {
					create: [
						// Group 1: Heading match Q14–19
						{
							id: 's321',
							examId: '3',
							order: 1,
							contentType: SectionType.Question,
							directive: PASSAGE_2 + P2_G1_INSTRUCTION,
							questions: {
								create: [
									{
										order: 14,
										content: '<p>Section A</p>',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'V', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['IELTS Reading P1-3', 'Matching Headings']),
										},
									},
									{
										order: 15,
										content: 'Section B',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'III', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
									},
									{
										order: 16,
										content: 'Section C',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'VIII', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
									},
									{
										order: 17,
										content: 'Section D',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'X', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
									},
									{
										order: 18,
										content: 'Section E',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'VI', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
									},
									{
										order: 19,
										content: 'Section F',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'II', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Matching Headings']) },
									},
								],
							},
							sectionTags: { create: this.tagNamesToIdInputs(['IELTS Reading P1-3']) },
						},
						// Group 2: Match statement to person Q20–26
						{
							id: 's322',
							examId: '3',
							order: 2,
							contentType: SectionType.Question,
							directive: P2_G2_INSTRUCTION,
							questions: {
								create: [
									{
										order: 20,
										content: '<p>3-D conflicts with our mental construct of our surroundings.</p>',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'F', isCorrect: true }],
										},
										questionTags: {
											create: this.tagNamesToIdInputs(['IELTS Reading P1-3', 'Detail Information']),
										},
									},
									{
										order: 21,
										content: '3-D encourages an over-emphasis on quick visual thrills.',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'G', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 22,
										content:
											'Effective use of 3-D technology may increase our sensation of elevation.',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'C', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 23,
										content: '3-D viewing can worsen an existing visual disorder.',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'E', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 24,
										content: 'Avatar is the most powerful example of 3-D yet to arrive in cinemas.',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'B', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 25,
										content:
											"Avatar's strength is found in its visual splendour, not in aspects of story.",
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'A', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
									},
									{
										order: 26,
										content:
											'People already have the mental capacity to see ordinary movies in three dimensions.',
										type: QuestionType.FillExactInTheBlank,
										choices: {
											create: [{ key: 'G', isCorrect: true }],
										},
										questionTags: { create: this.tagNamesToIdInputs(['Detail Information']) },
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
