import {
	type IExamSlugRepository,
	IExamSlugRepositoryToken,
} from '../../domain/repositories/exam-slug.repository';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { UseCls } from 'nestjs-cls';

const BATCH = 100;

/**
 * Gives every exam created before slugs existed a slug, at start-up. Idempotent (only empty slugs
 * are filled) and safe with several instances (a lost race is retried by `assignSlug`); a failure
 * is logged and never blocks start-up, and the next start tries again.
 */
@Injectable()
export class ExamSlugBackfill implements OnApplicationBootstrap {
	constructor(
		@Inject(IExamSlugRepositoryToken) private readonly slugRepository: IExamSlugRepository,
		private readonly logger: AppLoggerService,
	) {}

	onApplicationBootstrap(): void {
		void this.run().catch((e: unknown) =>
			this.logger.error(`Exam slug backfill failed: ${e instanceof Error ? e.message : String(e)}`),
		);
	}

	/** Returns how many exams got a slug. */
	@UseCls()
	async run(): Promise<number> {
		let filled = 0;
		for (;;) {
			const exams = await this.slugRepository.findWithoutSlug(BATCH);
			if (exams.length === 0) break;
			for (const exam of exams) {
				await this.slugRepository.assignSlug(exam.id, exam.title);
				filled++;
			}
			if (exams.length < BATCH) break;
		}
		if (filled > 0) this.logger.log(`Exam slug backfill: ${filled} exams`);
		return filled;
	}
}
