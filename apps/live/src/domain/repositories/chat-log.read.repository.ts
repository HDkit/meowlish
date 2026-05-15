import { ChatLog } from '../read-model/chat-log.read-model';

export interface IChatLogReadRepository {
	getChatLogsOf(
		roomId: string,
		options?: {
			uid?: string;
			id?: string;
			direction?: number;
			limit?: number;
			dateRange?: { from: Date; to: Date };
		},
	): Promise<ChatLog[]>;
}

export const IChatLogReadRepositoryToken = Symbol('IChatLogReadRepository');
