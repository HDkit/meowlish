import { ExamCreatedHandler, ExamDeletedHandler } from './handlers/exam-ownership.handler';
import { RoomCreatedHandler, RoomDeletedHandler } from './handlers/live-ownership.handler';
import {
	ResourceCreatedHandler,
	ResourceDeletedHandler,
} from './handlers/resource-ownership.handler';

export const OwnershipEventHandlers = [
	ExamCreatedHandler,
	ExamDeletedHandler,
	ResourceCreatedHandler,
	ResourceDeletedHandler,
	RoomCreatedHandler,
	RoomDeletedHandler,
];
