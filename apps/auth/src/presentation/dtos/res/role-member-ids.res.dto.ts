import { auth } from '@server/generated';
import { Expose } from 'class-transformer';

export class RoleMemberIdsDto implements auth.RoleMemberIds {
	@Expose()
	ids!: string[];
}
