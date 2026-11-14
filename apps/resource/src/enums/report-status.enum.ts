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

/**
 * Statuses that end a report's triage. They are all treated the same: the status, the response and
 * the files are frozen from then on (409 for everyone, staff included), and `resolvedBy` names the
 * staff member who moved the report into one of them.
 */
const FINAL_REPORT_STATUSES: ReadonlySet<string> = new Set([
	ReportStatus.Closed,
	ReportStatus.Dismissed,
	ReportStatus.Rejected,
	ReportStatus.Resolved,
]);

/** Takes a string: rows written before the enum existed may hold other values (never final). */
export const isFinalReportStatus = (status: string): boolean => FINAL_REPORT_STATUSES.has(status);
