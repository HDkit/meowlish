import { authorization } from '@server/generated';
import { IsString } from 'class-validator';

export class RegisterOwnershipReqDto implements authorization.RegisterOwnershipRequest {
	@IsString()
	resourceType!: string;

	@IsString()
	resourceId!: string;

	@IsString()
	ownerId!: string;
}
