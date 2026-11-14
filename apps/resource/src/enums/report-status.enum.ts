/**
 * Statuses a report may be moved to: the frontend's (pending, reviewing, resolved, rejected) and the
 * others notification has a phrase for. Values are lowercase because stored rows and both of those
 * consumers already use them (the column default is `pending`).
 */
export enum ReportStatus {
	Closed = 'closed',
	Dismissed = 'dismissed',
	InProgress = 'in_progress',
	Pending = 'pending',
	Rejected = 'rejected',
	Resolved = 'resolved',
	Reviewing = 'reviewing',
}
