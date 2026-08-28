import { authorization } from '@server/generated';
import { IsString } from 'class-validator';

export class CheckOwnershipReqDto implements authorization.CheckOwnershipRequest {
	@IsString()
	userId!: string;

	@IsString()
	resourceType!: string;

	@IsString()
	resourceId!: string;
}
