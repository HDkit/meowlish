import { type SeedAttemptPlan } from './attempt-builder';

/** Accounts created by the auth seed (apps/auth/prisma/seed.ts). */
export const SEED_USERS = { admin: 'admin', demo: 'demo' } as const;

/** Exam ids from `exams.ts`. */
const EXAM = {
	toeicLr1: '1',
	ieltsL1: '2',
	ieltsR1: '3',
	ieltsW1: '4',
	toeicLr2: '5',
	ieltsR2: '6',
	grammar: '7',
} as const;

const DEMO_ESSAYS = [
	`The bar chart compares the percentage of households in four countries that owned a car, a computer and a mobile phone in 2000 and 2020.

Overall, ownership of all three items rose in every country, but the most dramatic change was in mobile phones, which became almost universal by 2020. Car ownership, by contrast, grew only slightly.

In 2000, mobile phones were owned by fewer than half of households in three of the four countries, yet twenty years later the figures have increase to over 90 per cent everywhere. Computers followed a similar but less steep pattern, roughly doubling from around 35 per cent to 70 per cent.

Car ownership changed least. It stayed the highest in the United States at about 85 per cent and rose from 40 to 55 per cent in the other countries, which is not a very big increase compared with the other two items.`,
	`Some people think universities should mainly prepare students for a career, while others believe they should also develop students as people. In my view, a good university does both, although academic and professional skills should remain its main purpose.

On the one hand, students and their families invest a lot of time and money in higher education, so it is reasonable that they expect it to lead to employment. Courses that teach practical knowledge, such as accounting or engineering, help graduates find jobs quickly and contribute to the economy.

On the other hand, employers increasingly value communication, teamwork and the ability to manage stress. These life skills are developed through clubs, volunteering and group projects, which universities can support at a low cost. A graduate who only has technical knowledge may struggle in a real workplace.

In conclusion, universities should focus on knowledge and career preparation, but they should also give students opportunities to grow personally, because both are needed for a successful life.`,
];

/**
 * Practice history the seed gives the admin and demo accounts. Per (user, exam) pair at most one
 * attempt is open and attempts don't overlap (checked by `orderPairPlans`).
 *
 * Demo: 15 finished attempts over the last five weeks (scores trending up, a 4-day practice
 * streak up to today, 3 of them 80 %+), IELTS L/R/W, TOEIC LR and grammar, plus one open TOEIC
 * attempt. Keep `DEMO_PROGRESS` in apps/achievement/prisma/seed.ts in line with these numbers.
 */
export const SEED_ATTEMPT_PLANS: SeedAttemptPlan[] = [
	// ── admin ──
	{
		key: 'admin-toeic-lr1-1',
		userId: SEED_USERS.admin,
		examId: EXAM.toeicLr1,
		daysAgo: 12,
		utcHour: 9,
		minutes: 100,
		accuracy: 0.3,
		skipRate: 0.2,
	},
	{
		key: 'admin-toeic-lr1-2',
		userId: SEED_USERS.admin,
		examId: EXAM.toeicLr1,
		daysAgo: 5,
		utcHour: 10,
		minutes: 110,
		accuracy: 1,
		skipRate: 0,
	},
	{
		key: 'admin-toeic-lr1-3',
		userId: SEED_USERS.admin,
		examId: EXAM.toeicLr1,
		daysAgo: 0,
		utcHour: 0,
		minutes: 20,
		accuracy: 0.3,
		skipRate: 0.6,
		open: true,
	},
	{
		key: 'admin-ielts-l1-1',
		userId: SEED_USERS.admin,
		examId: EXAM.ieltsL1,
		daysAgo: 8,
		utcHour: 14,
		minutes: 50,
		accuracy: 1,
		skipRate: 0,
	},
	{
		key: 'admin-ielts-l1-2',
		userId: SEED_USERS.admin,
		examId: EXAM.ieltsL1,
		daysAgo: 2,
		utcHour: 15,
		minutes: 45,
		accuracy: 0.45,
		skipRate: 0.1,
	},
	{
		key: 'admin-ielts-r1-1',
		userId: SEED_USERS.admin,
		examId: EXAM.ieltsR1,
		daysAgo: 0,
		utcHour: 0,
		minutes: 10,
		accuracy: 0.2,
		skipRate: 0.7,
		open: true,
	},

	// ── demo ──
	{
		key: 'demo-ielts-l1-1',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsL1,
		daysAgo: 33,
		utcHour: 13,
		minutes: 52,
		accuracy: 0.55,
		skipRate: 0.08,
	},
	{
		key: 'demo-toeic-lr1-1',
		userId: SEED_USERS.demo,
		examId: EXAM.toeicLr1,
		daysAgo: 30,
		utcHour: 9,
		minutes: 115,
		accuracy: 0.52,
		skipRate: 0.06,
	},
	{
		key: 'demo-ielts-r1-1',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsR1,
		daysAgo: 27,
		utcHour: 14,
		minutes: 58,
		accuracy: 0.5,
		skipRate: 0.1,
	},
	{
		key: 'demo-grammar-1',
		userId: SEED_USERS.demo,
		examId: EXAM.grammar,
		daysAgo: 24,
		utcHour: 11,
		minutes: 38,
		accuracy: 0.65,
		skipRate: 0.05,
	},
	{
		key: 'demo-ielts-l1-2',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsL1,
		daysAgo: 20,
		utcHour: 13,
		minutes: 50,
		accuracy: 0.65,
		skipRate: 0.05,
	},
	{
		key: 'demo-ielts-r1-2',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsR1,
		daysAgo: 17,
		utcHour: 15,
		minutes: 57,
		accuracy: 0.6,
		skipRate: 0.08,
	},
	{
		key: 'demo-toeic-lr2-1',
		userId: SEED_USERS.demo,
		examId: EXAM.toeicLr2,
		daysAgo: 13,
		utcHour: 10,
		minutes: 112,
		accuracy: 0.6,
		skipRate: 0.05,
	},
	{
		key: 'demo-ielts-w1-1',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsW1,
		daysAgo: 11,
		utcHour: 14,
		minutes: 55,
		accuracy: 0,
		skipRate: 0,
		writing: { essays: DEMO_ESSAYS, band: 6 },
	},
	{
		key: 'demo-ielts-r2-1',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsR2,
		daysAgo: 9,
		utcHour: 13,
		minutes: 56,
		accuracy: 0.63,
		skipRate: 0.07,
	},
	{
		key: 'demo-ielts-l1-3',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsL1,
		daysAgo: 6,
		utcHour: 12,
		minutes: 48,
		accuracy: 0.85,
		skipRate: 0.02,
	},
	{
		key: 'demo-grammar-2',
		userId: SEED_USERS.demo,
		examId: EXAM.grammar,
		daysAgo: 5,
		utcHour: 16,
		minutes: 35,
		accuracy: 0.85,
		skipRate: 0,
	},
	{
		key: 'demo-ielts-r1-3',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsR1,
		daysAgo: 3,
		utcHour: 14,
		minutes: 55,
		accuracy: 0.7,
		skipRate: 0.05,
	},
	{
		key: 'demo-toeic-lr1-2',
		userId: SEED_USERS.demo,
		examId: EXAM.toeicLr1,
		daysAgo: 2,
		utcHour: 9,
		minutes: 110,
		accuracy: 0.68,
		skipRate: 0.04,
	},
	{
		key: 'demo-ielts-r2-2',
		userId: SEED_USERS.demo,
		examId: EXAM.ieltsR2,
		daysAgo: 1,
		utcHour: 13,
		minutes: 54,
		accuracy: 0.75,
		skipRate: 0.03,
	},
	{
		key: 'demo-grammar-3',
		userId: SEED_USERS.demo,
		examId: EXAM.grammar,
		daysAgo: 0,
		utcHour: 8,
		minutes: 30,
		accuracy: 0.9,
		skipRate: 0,
	},
	// the one open attempt: started a few minutes before the seed ran, TOEIC LR 2 allows 2 hours
	{
		key: 'demo-toeic-lr2-2',
		userId: SEED_USERS.demo,
		examId: EXAM.toeicLr2,
		daysAgo: 0,
		utcHour: 0,
		minutes: 5,
		accuracy: 0.3,
		skipRate: 0.6,
		open: true,
	},
];
