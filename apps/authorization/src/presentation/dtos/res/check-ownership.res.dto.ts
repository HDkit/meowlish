import { authorization } from '@server/generated';
import { Expose } from 'class-transformer';

export class CheckOwnershipResponseDto implements authorization.CheckOwnershipResponse {
	@Expose()
	isOwner!: boolean;
}
