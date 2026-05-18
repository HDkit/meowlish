export interface IOwnershipRepository {
	checkOwnership(resourceType: string, resourceId: string, userId: string): Promise<boolean>;
	registerOwnership(resourceType: string, resourceId: string, ownerId: string): Promise<void>;
	removeOwnership(resourceType: string, resourceId: string): Promise<void>;
}

export const IOwnershipRepositoryToken = Symbol('IOwnershipRepository');
