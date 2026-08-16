import { status } from '@grpc/grpc-js';
import {
	ArgumentsHost,
	Catch,
	ContextType,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AppLoggerService } from '@server/logger';
import { Observable } from 'rxjs';

@Catch(RpcException)
export class gRPC2HttpExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: AppLoggerService) {}

	static gRPCStatusCode: Record<number, number> = {
		[status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
		[status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
		[status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
		[status.NOT_FOUND]: HttpStatus.NOT_FOUND,
		[status.ALREADY_EXISTS]: HttpStatus.CONFLICT,
		[status.ABORTED]: HttpStatus.GONE,
		[status.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS,
		[status.CANCELLED]: 499,
		[status.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
		[status.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
		[status.UNKNOWN]: HttpStatus.BAD_GATEWAY,
		[status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
		[status.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
		[status.OUT_OF_RANGE]: HttpStatus.PAYLOAD_TOO_LARGE,
		[status.FAILED_PRECONDITION]: HttpStatus.PRECONDITION_FAILED,
	};

	catch(exception: RpcException, host: ArgumentsHost): Observable<never> | void {
		const contextType = host.getType<ContextType>();
		if (contextType !== 'http') throw exception;

		const err = exception.getError();

		this.logger.error(
			`[${this.constructor.name}] Exception Caught ${exception.message}`,
			'',
			exception.stack,
		);

		throw new HttpException(
			(err as { details?: string })?.details || '',
			gRPC2HttpExceptionFilter.gRPCStatusCode[(err as { code?: number })?.code || status.UNKNOWN],
		);
	}
}
