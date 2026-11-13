import { LoginType } from '../../enums/login-type.enum';
import { Credential } from './credential.entity';
import { Identity } from './identity.entity';
import { ConflictException, ForbiddenException } from '@nestjs/common';

const mailCred = () =>
	new Credential({
		id: 'mail',
		identifier: 'demo@lingriser.test',
		loginType: LoginType.Mail,
		secretHash: 'hash',
		isHashed: true,
	});
const googleCred = () =>
	new Credential({ id: 'google', identifier: 'g-1', loginType: LoginType.Google, isHashed: true });

const build = (isDemo: boolean) =>
	new Identity({
		id: 'i1',
		username: 'demo',
		phoneNumber: '0900000000',
		isDemo: isDemo,
		credentials: [mailCred(), googleCred()],
	});

describe('Identity demo guard', () => {
	it('defaults to a normal identity', () => {
		expect(new Identity({ username: 'u' }).isDemo).toBe(false);
	});

	describe('demo identity', () => {
		it.each([
			['change the password', (i: Identity) => i.updateCredential('mail', { secretHash: 'x' })],
			[
				'add a credential',
				(i: Identity) =>
					i.addCredential(
						new Credential({ identifier: 'x', loginType: LoginType.Google, isHashed: true }),
					),
			],
			['remove a credential', (i: Identity) => i.deleteCredential('google')],
			['change the username', (i: Identity) => i.updateDetails({ username: 'other' })],
			['change the phone number', (i: Identity) => i.updateDetails({ phoneNumber: '0911111111' })],
			['clear the phone number', (i: Identity) => i.updateDetails({ phoneNumber: null })],
		])("can't %s", (_, act) => {
			const identity = build(true);
			expect(() => act(identity)).toThrow(ForbiddenException);
			expect(identity.credentials.map(c => c.id)).toEqual(['mail', 'google']);
			expect(identity.credentials[0].secretHash).toBe('hash');
			expect(identity.username).toBe('demo');
			expect(identity.phoneNumber).toBe('0900000000');
			expect(identity.getUncommittedEvents()).toHaveLength(0);
		});

		it('can still edit fullName, bio and avatar (and re-send its own username/phone)', () => {
			const identity = build(true);
			identity.updateDetails({
				fullName: 'Tester',
				bio: 'hi',
				avatarFileId: 'f1',
				username: 'demo',
				phoneNumber: '0900000000',
			});
			expect(identity.fullName).toBe('Tester');
			expect(identity.bio).toBe('hi');
			expect(identity.avatarFileId).toBe('f1');
		});
	});

	it('leaves a normal identity unaffected', () => {
		const identity = build(false);
		identity.updateDetails({ username: 'other', phoneNumber: '0911111111' });
		identity.deleteCredential('google');
		identity.addCredential(
			new Credential({ identifier: 'g-9', loginType: LoginType.Google, isHashed: true }),
		);
		identity.updateCredential('mail', { identifier: 'new@y.z' });
		expect(identity.username).toBe('other');
		expect(identity.phoneNumber).toBe('0911111111');
		expect(identity.credentials.map(c => c.identifier)).toEqual(['new@y.z', 'g-9']);
	});
});

describe('Identity.addCredential', () => {
	it('allows one sign-in method per type', () => {
		const identity = new Identity({ id: 'i2', username: 'u', credentials: [googleCred()] });
		expect(() =>
			identity.addCredential(
				new Credential({ identifier: 'g-2', loginType: LoginType.Google, isHashed: true }),
			),
		).toThrow(ConflictException);
		expect(identity.credentials).toHaveLength(1);
		identity.addCredential(mailCred());
		expect(identity.credentials.map(c => c.loginType)).toEqual([LoginType.Google, LoginType.Mail]);
	});
});
