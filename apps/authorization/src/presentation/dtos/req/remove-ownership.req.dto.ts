import { authorization } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveOwnershipReqDto implements authorization.RemoveOwnershipRequest {
	@IsString()
	resourceType!: string;

	@IsString()
	resourceId!: string;
}
