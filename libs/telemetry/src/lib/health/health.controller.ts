import { getMeter } from '../start-telemetry';
import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { ReadinessRegistry } from './readiness.registry';
import {
	Controller,
	Get,
	Inject,
	type OnModuleInit,
	Optional,
	SetMetadata,
	VERSION_NEUTRAL,
	Version,
} from '@nestjs/common';
import {
	type HealthCheckResult,
	HealthCheckService,
	type HealthIndicatorFunction,
	HealthIndicatorService,
} from '@nestjs/terminus';

export const HEALTH_OPTIONS = Symbol('HEALTH_OPTIONS');
export const HEALTH_PRISMA = Symbol('HEALTH_PRISMA');

export interface HealthModuleOptions {
	serviceName: string;
	prismaToken?: string | symbol;
	rabbitmq?: boolean;
}

interface PingableClient {
	$queryRawUnsafe: (query: string) => unknown;
}

const DATABASE_TIMEOUT_MS = 1000;

@SetMetadata('isPublic', true)
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController implements OnModuleInit {
	private lastReady = false;

	constructor(
		private readonly health: HealthCheckService,
		private readonly indicatorService: HealthIndicatorService,
		private readonly registry: ReadinessRegistry,
		private readonly rabbit: RabbitMqHealthIndicator,
		@Inject(HEALTH_OPTIONS) private readonly options: HealthModuleOptions,
		@Optional() @Inject(HEALTH_PRISMA) private readonly prisma?: PingableClient,
	) {}

	onModuleInit(): void {
		getMeter()
			.createObservableGauge('service_ready', {
				description: '1 when the service passed its last readiness evaluation, else 0',
			})
			.addCallback(async result => {
				try {
					await this.evaluate();
				} catch {
					this.lastReady = false;
				}
				result.observe(this.lastReady ? 1 : 0, { service: this.options.serviceName });
			});
	}

	@Version(VERSION_NEUTRAL)
	@Get('live')
	live(): { status: 'ok' } {
		return { status: 'ok' };
	}

	@Version(VERSION_NEUTRAL)
	@Get('ready')
	async ready(): Promise<HealthCheckResult> {
		return this.evaluate();
	}

	private async evaluate(): Promise<HealthCheckResult> {
		try {
			const result = await this.health.check(this.indicators());
			this.lastReady = true;
			return result;
		} catch (error) {
			this.lastReady = false;
			throw error;
		}
	}

	private indicators(): HealthIndicatorFunction[] {
		const list: HealthIndicatorFunction[] = [];
		const prisma = this.prisma;
		if (prisma) {
			list.push(async () => {
				const session = this.indicatorService.check('database');
				let timer: NodeJS.Timeout | undefined;
				try {
					await Promise.race([
						Promise.resolve(prisma.$queryRawUnsafe('SELECT 1')),
						new Promise((_, reject) => {
							timer = setTimeout(() => reject(new Error('timeout')), DATABASE_TIMEOUT_MS);
						}),
					]);
					return session.up();
				} catch (error) {
					return session.down(error instanceof Error ? error.message : 'database check failed');
				} finally {
					clearTimeout(timer);
				}
			});
		}
		if (this.options.rabbitmq) {
			list.push(() => this.rabbit.check('rabbitmq'));
		}
		for (const [name, check] of this.registry.entries()) {
			list.push(async () => {
				const session = this.indicatorService.check(name);
				try {
					return (await check()) ? session.up() : session.down();
				} catch (error) {
					return session.down(error instanceof Error ? error.message : 'check failed');
				}
			});
		}
		return list;
	}
}
