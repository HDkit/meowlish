import { ExamStatus } from '../../src/enums/exam-status.enum';
import { IeltsLExamSect12Seeder } from './exam-ielts-l-sect-1-2';
import { IeltsLExamSect34Seeder } from './exam-ielts-l-sect-3-4';
import { Prisma } from '@prisma-client/exam';

export class IeltsLExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		const sect12 = new IeltsLExamSect12Seeder(this.tagNamesToIdInputs).seed();
		const sect34 = new IeltsLExamSect34Seeder(this.tagNamesToIdInputs).seed();
		return {
			id: '2',
			createdBy: 'admin-id',
			title: 'IELTS L 1',
			duration: 60 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['IELTS Listening P1-4']),
					skipDuplicates: true,
				},
			},
			sections: { create: [...sect12, ...sect34] },
		};
	}
}
