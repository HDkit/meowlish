import { IsNotEmpty, IsString } from 'class-validator';

/** `exam.exam.created` / `live.room.created`: the handler knows the type from the routing key. */
export class ResourceCreatedEvent {
	@IsNotEmpty()
	@IsString()
	resourceId!: string;

	@IsNotEmpty()
	@IsString()
	ownerId!: string;
}

/** `resource.resource.created`: the type is part of the payload (`blog`, `flashcard`). */
export class TypedResourceCreatedEvent extends ResourceCreatedEvent {
	@IsNotEmpty()
	@IsString()
	resourceType!: string;
}

/** `exam.exam.deleted` / `live.room.deleted`. */
export class ResourceDeletedEvent {
	@IsNotEmpty()
	@IsString()
	resourceId!: string;
}

/** `resource.resource.deleted`. */
export class TypedResourceDeletedEvent extends ResourceDeletedEvent {
	@IsNotEmpty()
	@IsString()
	resourceType!: string;
}
