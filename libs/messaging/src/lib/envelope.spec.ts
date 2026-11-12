import { createEnvelope, unwrapEvent } from './envelope';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('envelope', () => {
	it('createEnvelope sets a uuid id, the type and an ISO timestamp', () => {
		const now = new Date('2026-11-12T10:00:00.000Z');

		const envelope = createEnvelope('auth.user.created', { uid: 'u1' }, now);

		expect(envelope.id).toMatch(UUID_V4);
		expect(envelope.type).toBe('auth.user.created');
		expect(envelope.occurredAt).toBe('2026-11-12T10:00:00.000Z');
		expect(envelope.payload).toEqual({ uid: 'u1' });
	});

	it('createEnvelope defaults the timestamp to the current time', () => {
		const before = Date.now();

		const envelope = createEnvelope('auth.user.created', {});

		const occurred = Date.parse(envelope.occurredAt);
		expect(occurred).toBeGreaterThanOrEqual(before);
		expect(occurred).toBeLessThanOrEqual(Date.now());
	});

	it('unwrapEvent returns envelope fields', () => {
		const envelope = createEnvelope('exam.created', { examId: 'e1' });

		expect(unwrapEvent<{ examId: string }>(envelope)).toStrictEqual({
			id: envelope.id,
			type: envelope.type,
			payload: { examId: 'e1' },
		});
	});

	it('unwrapEvent treats a bare payload as legacy', () => {
		expect(unwrapEvent({ uid: 'u1' })).toStrictEqual({ payload: { uid: 'u1' } });
	});

	it('unwrapEvent treats an object with a non-string id as legacy', () => {
		const message = { id: 42, type: 'exam.created', payload: { examId: 'e1' } };

		expect(unwrapEvent(message)).toStrictEqual({ payload: message });
	});
});
