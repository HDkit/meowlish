import { type FlashCardProposalStatus } from '@server/typing';
import { type PageInput } from './pagination';

export interface CreateFlashCardProposalInput {
	/** The requester's copy; the proposal targets its original. */
	sourceListId: string;
	title: string;
	message?: string;
}

export interface ListFlashCardProposalsInput extends PageInput {
	targetListId?: string;
	sourceListId?: string;
	/** Only proposals the requester made. */
	mine?: boolean;
	status?: FlashCardProposalStatus;
}

export interface ConflictResolutionInput {
	targetCardId: string;
	/** Apply the proposal's version (true) or keep the owner's (false). */
	apply: boolean;
}

export interface AcceptFlashCardProposalInput {
	id: string;
	resolutions: ConflictResolutionInput[];
	decisionNote?: string;
}
