import { getMeter } from '../start-telemetry';
import {
	type CallHandler,
	type ExecutionContext,
	HttpException,
	Injectable,
	type NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Histogram } from '@opentelemetry/api';
import { type Observable, catchError, tap, throwError } from 'rxjs';

const GRPC_UNKNOWN = 2;

const HTTP_TO_GRPC: Record<number, number> = {
	400: 3,
	401: 16,
	403: 7,
	404: 5,
	409: 6,
	429: 8,
	501: 12,
	503: 14,
	504: 4,
};

export function grpcStatusCode(error: unknown): number {
	if (error instanceof RpcException) {
		const inner: unknown = error.getError();
		if (typeof inner === 'object' && inner !== null && 'code' in inner) {
			const code = inner.code;
			if (typeof code === 'number') return code;
		}
		return GRPC_UNKNOWN;
	}
	if (error instanceof HttpException) {
		return HTTP_TO_GRPC[error.getStatus()] ?? GRPC_UNKNOWN;
	}
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const code = error.code;
		if (typeof code === 'number') return code;
	}
	return GRPC_UNKNOWN;
}

/** Records `rpc_server_duration` (ms) for gRPC handlers; auto-instrumentation only emits spans. */
@Injectable()
export class RpcMetricsInterceptor implements NestInterceptor {
	private histogram?: Histogram;

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== 'rpc') return next.handle();

		const start = performance.now();
		const method = `${context.getClass().name}.${context.getHandler().name}`;
		const record = (code: number): void => {
			this.histogram ??= getMeter().createHistogram('rpc_server_duration', {
				unit: 'ms',
				description: 'Duration of gRPC server handlers',
			});
			this.histogram.record(performance.now() - start, {
				rpc_method: method,
				rpc_grpc_status_code: code,
			});
		};

		return next.handle().pipe(
			tap({ complete: () => record(0) }),
			catchError((error: unknown) => {
				record(grpcStatusCode(error));
				return throwError(() => error);
			}),
		);
	}
}
