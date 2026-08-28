import { ExamStatus } from '../../src/enums/exam-status.enum';
import { IeltsRExamSect12Seeder } from './exam-ielts-r-sect-1-2';
import { IeltsRExamSect3Seeder } from './exam-ielts-r-sect-3';
import { Prisma } from '@prisma-client/exam';

export class IeltsRExamSeeder {
	constructor(private readonly tagNamesToIdInputs: (names: string[]) => { tagId: string }[]) {}

	seed(): Prisma.ExamCreateInput {
		const sect12 = new IeltsRExamSect12Seeder(this.tagNamesToIdInputs).seed();
		const sect3 = new IeltsRExamSect3Seeder(this.tagNamesToIdInputs).seed();
		return {
			id: '3',
			createdBy: 'admin',
			title: 'IELTS R 1',
			duration: 60 * 60,
			status: ExamStatus.Approved,
			examTags: {
				createMany: {
					data: this.tagNamesToIdInputs(['IELTS Reading P1-3']),
					skipDuplicates: true,
				},
			},
			sections: { create: [...sect12, ...sect3] },
		};
	}
}
