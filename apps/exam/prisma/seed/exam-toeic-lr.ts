import { ExamStatus } from '../../src/enums/exam-status.enum';
import { ToeicLrExamSect12Seeder } from './exam-toeic-lr-sect-1-2';
import { ToeicLrExamSect34Seeder } from './exam-toeic-lr-sect-3-4';
import { ToeicLrExamSect56Seeder } from './exam-toeic-lr-sect-5-6';
import { ToeicLrExamSect7Seeder } from './exam-toeic-lr-sect-7';
import { Prisma } from '@prisma-client/exam';

export class ToeicLrExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		const sect12 = new ToeicLrExamSect12Seeder(this.tagNamesToIdInputs).seed();
		const sect34 = new ToeicLrExamSect34Seeder(this.tagNamesToIdInputs).seed();
		const sect56 = new ToeicLrExamSect56Seeder(this.tagNamesToIdInputs).seed();
		const sect7 = new ToeicLrExamSect7Seeder(this.tagNamesToIdInputs).seed();
		return {
			id: '1',
			createdBy: 'admin',
			title: 'TOEIC LR 1',
			duration: 2 * 60 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['TOEIC Listening', 'TOEIC Reading']),
					skipDuplicates: true,
				},
			},
			sections: { create: [...sect12, ...sect34, ...sect56, ...sect7] },
		};
	}
}
