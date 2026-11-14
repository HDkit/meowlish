import { LoginType } from '../../enums/login-type.enum';
import { IEntity } from '@server/utils';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export class Credential implements IEntity<Credential> {
	public static newId(): string {
		return crypto.randomUUID();
	}

	/**
	 * Hashes a plain-text password for `secretHash`. Async (libuv thread pool), so hashing doesn't
	 * block the event loop for every other request.
	 */
	public static hashSecret(plain: string): Promise<string> {
		return bcrypt.hash(plain, BCRYPT_ROUNDS);
	}

	public readonly id: string;
	public identifier: string;
	public loginType: LoginType;
	/** Always a bcrypt hash (see `hashSecret`), never the plain password. */
	public secretHash: string | null;

	public constructor(constructorOptions: {
		id?: string;
		identifier: string;
		loginType: LoginType;
		secretHash?: string | null;
	}) {
		this.id = constructorOptions.id ?? Credential.newId();
		this.identifier = constructorOptions.identifier;
		this.loginType = constructorOptions.loginType;
		this.secretHash = constructorOptions.secretHash ?? null;
	}

	public update(options: CredentialUpdatableProperties): void {
		if (options.identifier) this.identifier = options.identifier;
		if (options.secretHash) this.secretHash = options.secretHash;
	}
}

export type CredentialUpdatableProperties = Partial<Pick<Credential, 'identifier' | 'secretHash'>>;
