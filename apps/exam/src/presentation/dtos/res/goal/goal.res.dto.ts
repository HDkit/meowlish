import { exam } from '@server/generated';
import { Expose } from 'class-transformer';

export class GoalResDto implements exam.GoalResponse {
	@Expose()
	date!: Date;

	@Expose()
	target!: number;

	@Expose()
	type!: string;

	@Expose()
	uid!: string;
}
