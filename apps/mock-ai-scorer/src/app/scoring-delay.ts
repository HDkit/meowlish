import { IEnvVars } from '../configs/config';
import { pickDelayMs } from './score-generator';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Waits a random time in [MOCK_SCORER_MIN_DELAY_MS, MOCK_SCORER_MAX_DELAY_MS]. */
@Injectable()
export class ScoringDelay {
	constructor(private readonly configService: ConfigService<IEnvVars>) {}

	async wait(): Promise<void> {
		const { minDelayMs, maxDelayMs } = this.configService.getOrThrow('scorer', { infer: true });
		const ms = pickDelayMs(minDelayMs, maxDelayMs);
		await new Promise<void>(resolve => setTimeout(resolve, ms));
	}
}
