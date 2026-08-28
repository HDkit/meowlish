import { auth } from '@server/generated';
import { Expose } from 'class-transformer';

export class IdentityIdsDto implements auth.IdentityIds {
	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;

	@Expose()
	ids!: string[];
}
