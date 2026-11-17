import { Injectable } from '@nestjs/common';

export type ReadinessCheck = () => boolean | Promise<boolean>;

@Injectable()
export class ReadinessRegistry {
	private readonly checks = new Map<string, ReadinessCheck>();

	register(name: string, check: ReadinessCheck): void {
		this.checks.set(name, check);
	}

	entries(): [string, ReadinessCheck][] {
		return [...this.checks.entries()];
	}
}
