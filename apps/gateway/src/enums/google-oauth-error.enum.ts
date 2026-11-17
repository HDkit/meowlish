/** `?error=` that a failed Google flow puts on the frontend's login callback URL. */
export enum GoogleOAuthError {
	/** The user cancelled on Google's consent screen. */
	Cancelled = 'ACCESS_DENIED',
	/** The OAuth state is missing, expired, already used or from another browser. */
	SessionExpired = 'SESSION_EXPIRED',
	/** Linking: the account already has a Google sign-in method. */
	AlreadyLinked = 'GOOGLE_ALREADY_LINKED',
	/** Linking: this Google account signs in to another account. */
	AccountInUse = 'GOOGLE_ACCOUNT_IN_USE',
	/** Locked account, or the demo account (read-only sign-in methods). */
	Forbidden = 'FORBIDDEN',
	Failed = 'GOOGLE_FAILED',
}
