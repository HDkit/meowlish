import { randomUUID } from 'node:crypto';

export interface EventEnvelope<T> {
	id: string;
	type: string;
	occurredAt: string;
	payload: T;
}

export function createEnvelope<T>(
	type: string,
	payload: T,
	now: Date = new Date(),
): EventEnvelope<T> {
	return {
		id: randomUUID(),
		type: type,
		occurredAt: now.toISOString(),
		payload: payload,
	};
}

export function unwrapEvent<T>(message: unknown): { id?: string; type?: string; payload: T } {
	if (isEnvelope(message)) {
		return { id: message.id, type: message.type, payload: message.payload as T };
	}
	return { payload: message as T };
}

function isEnvelope(message: unknown): message is { id: string; type: string; payload: object } {
	if (typeof message !== 'object' || message === null) {
		return false;
	}
	if (!('id' in message) || !('type' in message) || !('payload' in message)) {
		return false;
	}
	return (
		typeof message.id === 'string' &&
		typeof message.type === 'string' &&
		typeof message.payload === 'object' &&
		message.payload !== null
	);
}
