import { FileAddedPublisher } from './file-added.publisher';
import { FilesRemovedPublisher, FilesRemovedScheduler } from './files-removed.publisher';
import { IdentityLockedPublisher } from './identity-locked.publisher';
import { UserLoggedInPublisher } from './logged-in.publisher';

export const IntegrationEventPublishers = [
	UserLoggedInPublisher,
	FilesRemovedPublisher,
	FilesRemovedScheduler,
	FileAddedPublisher,
	IdentityLockedPublisher,
];
