/** Review status of an exam. Mirrors exam's `ExamStatus` (the gateway can't import from apps/exam). */
export enum ExamStatus {
	Approved = 'APPROVED',
	Pending = 'PENDING',
	Rejected = 'REJECTED',
}
