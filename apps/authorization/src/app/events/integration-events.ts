export interface ResourceCreatedEvent {
	resourceType: string;
	resourceId: string;
	ownerId: string;
}

export interface ResourceDeletedEvent {
	resourceType: string;
	resourceId: string;
}
