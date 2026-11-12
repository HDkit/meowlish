/**
 * Value of one cookie from a raw `Cookie` header, or `undefined`.
 * Kept dependency-free so both the gateway (Express) and live (socket.io handshake) can use it.
 */
export const readCookie = (header: string | undefined, name: string): string | undefined => {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const eq = part.indexOf('=');
		if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
		let value = part.slice(eq + 1).trim();
		if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
		if (!value) return undefined;
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	return undefined;
};
