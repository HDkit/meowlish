import { exam } from '@server/generated';
import { Expose } from 'class-transformer';

export class ExamCountsDto implements exam.ExamCountsResponse {
	@Expose()
	total!: number;

	@Expose()
	approved!: number;

	@Expose()
	pending!: number;

	@Expose()
	rejected!: number;
}
