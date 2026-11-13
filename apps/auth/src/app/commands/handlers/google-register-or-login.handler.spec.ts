import { Identity } from '../../../domain/entities/identity.entity';
import { GoogleRegisterOrLoginCommand } from '../auth.google-register-or-login.command';
import {
	GoogleRegisterOrLoginCommandHandler,
	isGeneratedUsername,
	usernameBaseFromEmail,
} from './google-register-or-login.handler';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

const GENERATED = '0b6f7f9e-3c1a-4c55-9d7e-2f1f3b0a9c11';

const setup = (opts: { existing?: Identity; taken?: string[] } = {}) => {
	const taken = new Set(opts.taken);
	const repo = {
		findOneCredential: jest
			.fn()
			.mockResolvedValue(opts.existing ? { identityId: opts.existing.id, secretHash: null } : null),
		findOneById: jest.fn().mockResolvedValue(opts.existing ?? null),
		findOneByUsername: jest.fn((username: string, deleted = false) =>
			Promise.resolve(!deleted && taken.has(username) ? ({} as Identity) : null),
		),
		getClaimsOfId: jest.fn().mockResolvedValue({ roles: [], permissions: [] }),
		save: jest.fn(),
	};
	const roles = { findByName: jest.fn().mockResolvedValue({ id: 'student' }) };
	const handler = new GoogleRegisterOrLoginCommandHandler(
		repo as never,
		roles as never,
		{ publish: jest.fn() } as never,
		{
			generateTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
		} as never,
	);
	return { repo: repo, handler: handler };
};

const cmd = (profile: { fullName?: string; email?: string } = {}) =>
	new GoogleRegisterOrLoginCommand({ identifier: 'g-1', username: GENERATED, ...profile });

const savedIdentity = (repo: ReturnType<typeof setup>['repo']) =>
	(repo.save.mock.calls[0] as [Identity])[0];

describe('usernameBaseFromEmail', () => {
	it.each([
		['Van.A+test@gmail.com', 'van.atest'],
		['__x__@a.b', 'x'],
		['nguyễn@a.b', 'nguyn'],
		['+++@a.b', ''],
		[undefined, ''],
	])('%s -> %p', (email, base) => expect(usernameBaseFromEmail(email)).toBe(base));

	it('is at most 30 characters', () => {
		expect(usernameBaseFromEmail(`${'a'.repeat(40)}@a.b`)).toHaveLength(30);
	});
});

describe('Google sign-up', () => {
	it('names the account after the Google profile', async () => {
		const { repo, handler } = setup();
		await handler.execute(cmd({ fullName: ' Nguyễn Văn A ', email: 'van.a@gmail.com' }));
		const identity = savedIdentity(repo);
		expect(identity.fullName).toBe('Nguyễn Văn A');
		expect(identity.username).toBe('van.a');
	});

	it('adds a random suffix when the username is taken', async () => {
		const { repo, handler } = setup({ taken: ['van.a'] });
		await handler.execute(cmd({ email: 'van.a@gmail.com' }));
		expect(savedIdentity(repo).username).toMatch(/^van\.a-[0-9a-f]{4}$/);
	});

	it('falls back to the given username without a usable email', async () => {
		const { repo, handler } = setup();
		await handler.execute(cmd());
		const identity = savedIdentity(repo);
		expect(identity.username).toBe(GENERATED);
		expect(identity.fullName).toBeNull();
	});
});

describe('Google login', () => {
	it('fills the name and replaces the UUID username of an older Google account', async () => {
		const existing = new Identity({ id: 'i1', username: GENERATED });
		const { repo, handler } = setup({ existing: existing });
		await handler.execute(cmd({ fullName: 'Nguyễn Văn A', email: 'van.a@gmail.com' }));
		expect(repo.save).toHaveBeenCalledTimes(1);
		expect(existing.fullName).toBe('Nguyễn Văn A');
		expect(existing.username).toBe('van.a');
	});

	it('leaves a name and username the user chose', async () => {
		const existing = new Identity({ id: 'i1', username: 'mine', fullName: 'My Name' });
		const { repo, handler } = setup({ existing: existing });
		await handler.execute(cmd({ fullName: 'Google Name', email: 'g@gmail.com' }));
		expect(repo.save).not.toHaveBeenCalled();
		expect(existing.fullName).toBe('My Name');
		expect(existing.username).toBe('mine');
	});

	it('recognises generated usernames', () => {
		expect(isGeneratedUsername(GENERATED)).toBe(true);
		expect(isGeneratedUsername('van.a')).toBe(false);
	});
});
