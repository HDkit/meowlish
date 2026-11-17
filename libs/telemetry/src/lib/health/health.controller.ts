import { getMeter } from '../start-telemetry';
import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { ReadinessRegistry } from './readiness.registry';
import {
	ArgumentsHost,
	Catch,
	Controller,
	type ExceptionFilter,
	Get,
	Inject,
	type ModuleMetadata,
	type OnModuleInit,
	Optional,
	SerializeOptions,
	ServiceUnavailableException,
	SetMetadata,
	UseFilters,
	VERSION_NEUTRAL,
	Version,
} from '@nestjs/common';
import {
	type HealthCheckResult,
	HealthCheckService,
	type HealthIndicatorFunction,
	type HealthIndicatorResult,
	HealthIndicatorService,
} from '@nestjs/terminus';

export const HEALTH_OPTIONS = Symbol('HEALTH_OPTIONS');
export const HEALTH_PRISMA = Symbol('HEALTH_PRISMA');

export interface HealthModuleOptions {
	serviceName: string;
	prismaToken?: string | symbol;
	rabbitmq?: boolean;
	checkTimeoutMs?: number;
	/** Modules that provide `prismaToken` when it is not globally visible. */
	imports?: ModuleMetadata['imports'];
}

interface PingableClient {
	$queryRawUnsafe: (query: string) => unknown;
}

const CHECK_TIMEOUT_MS = 1000;

/** Writes terminus's failure payload as JSON, bypassing app-wide catch-all filters. */
@Catch(ServiceUnavailableException)
export class HealthUnavailableFilter implements ExceptionFilter<ServiceUnavailableException> {
	catch(exception: ServiceUnavailableException, host: ArgumentsHost): void {
		host
			.switchToHttp()
			.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>()
			.status(exception.getStatus())
			.json(exception.getResponse());
	}
}

@UseFilters(HealthUnavailableFilter)
// Apps install a global serializer with `excludeAll`, which would strip the plain payload to `{}`.
@SerializeOptions({ strategy: 'exposeAll', excludeExtraneousValues: false })
@SetMetadata('isPublic', true)
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController implements OnModuleInit {
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
				let ready = false;
				try {
					await this.evaluate();
					ready = true;
				} catch {
					ready = false;
				}
				result.observe(ready ? 1 : 0, { service: this.options.serviceName });
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

	private evaluate(): Promise<HealthCheckResult> {
		return this.health.check(this.indicators());
	}

	private async guarded(
		key: string,
		run: () => unknown,
		isUp: (value: unknown) => boolean,
	): Promise<HealthIndicatorResult> {
		const session = this.indicatorService.check(key);
		const timeoutMs = this.options.checkTimeoutMs ?? CHECK_TIMEOUT_MS;
		let timer: NodeJS.Timeout | undefined;
		try {
			const value = await Promise.race([
				Promise.resolve().then(run),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
				}),
			]);
			return isUp(value) ? session.up() : session.down();
		} catch (error) {
			return session.down(error instanceof Error ? error.message : `${key} check failed`);
		} finally {
			clearTimeout(timer);
		}
	}

	private indicators(): HealthIndicatorFunction[] {
		const list: HealthIndicatorFunction[] = [];
		const prisma = this.prisma;
		if (prisma) {
			list.push(() =>
				this.guarded(
					'database',
					() => prisma.$queryRawUnsafe('SELECT 1'),
					() => true,
				),
			);
		}
		if (this.options.rabbitmq) {
			list.push(() => this.rabbit.check('rabbitmq'));
		}
		for (const [name, check] of this.registry.entries()) {
			list.push(() => this.guarded(name, check, value => value === true));
		}
		return list;
	}
}
