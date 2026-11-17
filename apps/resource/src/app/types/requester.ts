/** Who is calling, as asserted by the gateway. */
export interface Requester {
	id: string;
	/** Requester may bypass ownership and visibility checks (e.g. admin/mod, decided by the gateway). */
	privileged: boolean;
}
