import { CursorPaginationHelper } from './cursor';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

/**
 * Creates cursor helpers signed with the app's `cursorSecret` config value (env `CURSOR_SECRET`).
 * Each namespace gets its own key, so a cursor from one endpoint can't be replayed on another.
 *
 * When unset, a random per-process secret is used: cursors stay unforgeable but stop working across
 * restarts and between replicas, so set it in production.
 */
@Injectable()
export class CursorPaginationFactory {
	private readonly secret: string;

	constructor(configService: ConfigService) {
		const secret = configService.get<string>('cursorSecret');
		if (!secret && configService.get<string>('env') === 'production') {
			console.warn(
				'CURSOR_SECRET is not set: using a random per-process key, so pagination cursors will not survive restarts or work across replicas',
			);
		}
		this.secret = secret ?? randomBytes(32).toString('hex');
	}

	create(namespace: string): CursorPaginationHelper {
		return new CursorPaginationHelper(`${this.secret}:${namespace}`);
	}
}
