import { SEED_USERS } from './users';

export interface SeedFlashCard {
	id: string;
	word: string;
	definition: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
}

export interface SeedFlashCardList {
	id: string;
	authorId: string;
	name: string;
	description: string;
	isPublic: boolean;
	tags: string[];
	/** Days before the seed runs. */
	daysAgo: number;
	cards: SeedFlashCard[];
}

/** The shared demo account's own lists (ids `seed-fcl-demo-*`, cards `seed-fc-demo-*`). */
export const DEMO_FLASHCARD_LISTS: SeedFlashCardList[] = [
	{
		id: 'seed-fcl-demo-ielts-academic',
		authorId: SEED_USERS.demo,
		name: 'IELTS Academic Word List',
		description: 'Từ vựng học thuật hay gặp trong IELTS Reading và Writing Task 2.',
		isPublic: true,
		tags: ['ielts', 'academic'],
		daysAgo: 21,
		cards: [
			{
				id: 'seed-fc-demo-ielts-1',
				word: 'significant',
				definition: 'đáng kể, quan trọng',
				partOfSpeech: 'adjective',
				pronunciation: '/sɪɡˈnɪf.ɪ.kənt/',
				examples: ['There was a significant increase in sales.'],
			},
			{
				id: 'seed-fc-demo-ielts-2',
				word: 'hypothesis',
				definition: 'giả thuyết',
				partOfSpeech: 'noun',
				pronunciation: '/haɪˈpɒθ.ə.sɪs/',
				examples: ['The results support the hypothesis.'],
			},
			{
				id: 'seed-fc-demo-ielts-3',
				word: 'subsequently',
				definition: 'sau đó, về sau',
				partOfSpeech: 'adverb',
				pronunciation: '/ˈsʌb.sɪ.kwənt.li/',
				examples: ['The building was subsequently demolished.'],
			},
			{
				id: 'seed-fc-demo-ielts-4',
				word: 'allocate',
				definition: 'phân bổ',
				partOfSpeech: 'verb',
				pronunciation: '/ˈæl.ə.keɪt/',
				examples: ['The government allocated more funds to education.'],
			},
			{
				id: 'seed-fc-demo-ielts-5',
				word: 'controversial',
				definition: 'gây tranh cãi',
				partOfSpeech: 'adjective',
				pronunciation: '/ˌkɒn.trəˈvɜː.ʃəl/',
				examples: ['Genetic engineering remains a controversial issue.'],
			},
			{
				id: 'seed-fc-demo-ielts-6',
				word: 'mitigate',
				definition: 'giảm nhẹ, làm dịu',
				partOfSpeech: 'verb',
				pronunciation: '/ˈmɪt.ɪ.ɡeɪt/',
				examples: ['Planting trees can mitigate the effects of pollution.'],
			},
		],
	},
	{
		id: 'seed-fcl-demo-toeic-office',
		authorId: SEED_USERS.demo,
		name: 'TOEIC: Văn phòng & Họp hành',
		description: 'Từ vựng TOEIC Part 3, 4 và 7 về công sở, cuộc họp và lịch làm việc.',
		isPublic: false,
		tags: ['toeic', 'office'],
		daysAgo: 12,
		cards: [
			{
				id: 'seed-fc-demo-toeic-1',
				word: 'postpone',
				definition: 'hoãn lại',
				partOfSpeech: 'verb',
				pronunciation: '/pəʊstˈpəʊn/',
				examples: ['The meeting has been postponed until Friday.'],
			},
			{
				id: 'seed-fc-demo-toeic-2',
				word: 'agenda',
				definition: 'chương trình nghị sự',
				partOfSpeech: 'noun',
				pronunciation: '/əˈdʒen.də/',
				examples: ['The budget is the first item on the agenda.'],
			},
			{
				id: 'seed-fc-demo-toeic-3',
				word: 'reimburse',
				definition: 'hoàn tiền, bồi hoàn',
				partOfSpeech: 'verb',
				pronunciation: '/ˌriː.ɪmˈbɜːs/',
				examples: ['The company will reimburse your travel expenses.'],
			},
			{
				id: 'seed-fc-demo-toeic-4',
				word: 'deadline',
				definition: 'hạn chót',
				partOfSpeech: 'noun',
				pronunciation: '/ˈded.laɪn/',
				examples: ['The deadline for the report is next Monday.'],
			},
			{
				id: 'seed-fc-demo-toeic-5',
				word: 'supervisor',
				definition: 'người giám sát, quản lý trực tiếp',
				partOfSpeech: 'noun',
				pronunciation: '/ˈsuː.pə.vaɪ.zər/',
				examples: ['Please ask your supervisor to sign the form.'],
			},
		],
	},
	{
		id: 'seed-fcl-demo-collocations',
		authorId: SEED_USERS.demo,
		name: 'Collocations hay dùng',
		description: 'Các cụm từ cố định giúp nói và viết tự nhiên hơn.',
		isPublic: false,
		tags: ['collocation'],
		daysAgo: 4,
		cards: [
			{
				id: 'seed-fc-demo-coll-1',
				word: 'make a decision',
				definition: 'đưa ra quyết định',
				examples: ['We need to make a decision by tomorrow.'],
			},
			{
				id: 'seed-fc-demo-coll-2',
				word: 'pay attention to',
				definition: 'chú ý đến',
				examples: ['Pay attention to the speaker’s tone in Part 3.'],
			},
			{
				id: 'seed-fc-demo-coll-3',
				word: 'take responsibility for',
				definition: 'chịu trách nhiệm về',
				examples: ['She took responsibility for the mistake.'],
			},
			{
				id: 'seed-fc-demo-coll-4',
				word: 'raise awareness',
				definition: 'nâng cao nhận thức',
				examples: ['The campaign aims to raise awareness of climate change.'],
			},
		],
	},
];
