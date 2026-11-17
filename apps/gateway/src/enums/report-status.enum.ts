/** Statuses a report may be moved to. Mirrors resource's `ReportStatus` (the gateway can't import from apps/resource). */
export enum ReportStatus {
	Closed = 'closed',
	Dismissed = 'dismissed',
	InProgress = 'in_progress',
	Pending = 'pending',
	Rejected = 'rejected',
	Resolved = 'resolved',
	Reviewing = 'reviewing',
}
