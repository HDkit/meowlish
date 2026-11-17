import { type OptionalNotificationType } from '../../types/notification.input';

export interface DiscussionRecipient {
	id: string;
	/** Preference that controls this notification. */
	preference: OptionalNotificationType;
	kind: 'owner' | 'replied';
}

/**
 * Who hears about a new comment/reply: the person answered (reply/quote) first, then the owner of
 * the post or thread. Nobody is told about their own message, and someone who is both gets one
 * notification (the more specific "replied to you").
 */
export const discussionRecipients = (
	authorId: string,
	owner: { id: string; preference: OptionalNotificationType },
	replied: { id: string | null; preference: OptionalNotificationType },
): DiscussionRecipient[] => {
	const recipients: DiscussionRecipient[] = [];
	if (replied.id && replied.id !== authorId) {
		recipients.push({ id: replied.id, preference: replied.preference, kind: 'replied' });
	}
	if (owner.id !== authorId && owner.id !== replied.id) {
		recipients.push({ id: owner.id, preference: owner.preference, kind: 'owner' });
	}
	return recipients;
};
