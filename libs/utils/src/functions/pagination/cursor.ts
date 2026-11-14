import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';

export class CursorPaginationHelper {
	constructor(private readonly secret: string) {}

	public encodeCursor<T>(data: T): string {
		const json = JSON.stringify(data);
		const payload = Buffer.from(json).toString('base64url');
		const signature = this.sign(payload);
		return `${payload}.${signature}`;
	}

	public decodeCursor<T>(cursor: string): T {
		const [payload, signature] = cursor.split('.');
		if (!payload || !signature) throw new BadRequestException('Invalid cursor');
		const expected = this.sign(payload);
		const given = Buffer.from(signature);
		const wanted = Buffer.from(expected);
		// timingSafeEqual throws on different lengths: a wrong-length signature is just invalid
		const isValid = given.length === wanted.length && timingSafeEqual(given, wanted);
		if (!isValid) throw new BadRequestException('Invalid cursor');
		const json = Buffer.from(payload, 'base64url').toString('utf-8');
		try {
			return JSON.parse(json) as T;
		} catch {
			throw new BadRequestException('Invalid cursor');
		}
	}

	private sign(data: string): string {
		return createHmac('sha256', this.secret).update(data).digest('base64url');
	}
}
