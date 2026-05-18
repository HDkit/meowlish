import { SetMetadata } from '@nestjs/common';
import { Role } from '@server/typing';

export const RESOURCE_ACCESS_KEY = 'resource_access';

export interface ResourceAccessRule {
	roles: Role[];
	requireOwnership?: boolean;
}

export interface ResourceAccessOptions {
	resourceType: string;
	resourceIdParam: string;
	rules: ResourceAccessRule[];
}

export const ResourceAccess = (options: ResourceAccessOptions) =>
	SetMetadata(RESOURCE_ACCESS_KEY, options);
