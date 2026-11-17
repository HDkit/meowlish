import { RpcMetricsInterceptor, grpcStatusCode } from './rpc-metrics.interceptor';
import { type CallHandler, type ExecutionContext, HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { lastValueFrom, of, throwError } from 'rxjs';

class TestReader extends MetricReader {
	protected onShutdown(): Promise<void> {
		return Promise.resolve();
	}
	protected onForceFlush(): Promise<void> {
		return Promise.resolve();
	}
}

class TagController {
	addTag = (): void => undefined;
}

const ctx = (type: string): ExecutionContext =>
	({
		getType: () => type,
		getClass: () => TagController,
		getHandler: () => ({ name: 'addTag' }),
	}) as unknown as ExecutionContext;

describe('RpcMetricsInterceptor', () => {
	let reader: TestReader;
	let interceptor: RpcMetricsInterceptor;

	const points = async (): Promise<{ attributes: Record<string, unknown>; count: number }[]> => {
		const { resourceMetrics } = await reader.collect();
		const metric = resourceMetrics.scopeMetrics
			.flatMap(s => s.metrics)
			.find(m => m.descriptor.name === 'rpc_server_duration');
		expect(metric === undefined || metric.descriptor.unit === 'ms').toBe(true);
		return (metric?.dataPoints ?? []).map(p => ({
			attributes: p.attributes,
			count: (p.value as { count: number }).count,
		}));
	};

	beforeEach(() => {
		metrics.disable();
		reader = new TestReader();
		metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
		interceptor = new RpcMetricsInterceptor();
	});

	it('records code 0 on success', async () => {
		const handler: CallHandler = { handle: () => of('ok') };
		await lastValueFrom(interceptor.intercept(ctx('rpc'), handler));
		expect(await points()).toEqual([
			{
				attributes: { rpc_method: 'TagController.addTag', rpc_grpc_status_code: 0 },
				count: 1,
			},
		]);
	});

	it('records the gRPC code and rethrows the same error', async () => {
		const error = new RpcException({ code: 5, message: 'nope' });
		const handler: CallHandler = { handle: () => throwError(() => error) };
		await expect(lastValueFrom(interceptor.intercept(ctx('rpc'), handler))).rejects.toBe(error);
		expect((await points())[0].attributes).toMatchObject({ rpc_grpc_status_code: 5 });
	});

	it('falls back to UNKNOWN (2) for unmapped errors', async () => {
		const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };
		await expect(lastValueFrom(interceptor.intercept(ctx('rpc'), handler))).rejects.toThrow('boom');
		expect((await points())[0].attributes).toMatchObject({ rpc_grpc_status_code: 2 });
	});

	it('does not record for http contexts', async () => {
		const handler: CallHandler = { handle: () => of('ok') };
		await lastValueFrom(interceptor.intercept(ctx('http'), handler));
		expect(await points()).toEqual([]);
	});

	it('maps HttpException statuses', () => {
		expect(grpcStatusCode(new HttpException('x', 404))).toBe(5);
		expect(grpcStatusCode(new HttpException('x', 418))).toBe(2);
	});
});
