export type UserLoggedInIntegrationEvent = {
	uid: string;
	/** ISO 8601; the same string the broker used to receive for a serialized `Date`. */
	date: string;
};
