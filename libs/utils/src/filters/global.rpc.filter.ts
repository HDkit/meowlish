import { status } from '@grpc/grpc-js';
import {
	type ArgumentsHost,
	Catch,
	type ContextType,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { throwError } from 'rxjs';

@Catch()
export class GlobalRpcExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: AppLoggerService) {}

	static HttpStatusCode: Record<number, number> = {
		[HttpStatus.BAD_REQUEST]: status.INVALID_ARGUMENT,
		[HttpStatus.UNAUTHORIZED]: status.UNAUTHENTICATED,
		[HttpStatus.FORBIDDEN]: status.PERMISSION_DENIED,
		[HttpStatus.NOT_FOUND]: status.NOT_FOUND,
		[HttpStatus.CONFLICT]: status.ALREADY_EXISTS,
		[HttpStatus.GONE]: status.ABORTED,
		[HttpStatus.TOO_MANY_REQUESTS]: status.RESOURCE_EXHAUSTED,
		499: status.CANCELLED,
		[HttpStatus.INTERNAL_SERVER_ERROR]: status.INTERNAL,
		[HttpStatus.NOT_IMPLEMENTED]: status.UNIMPLEMENTED,
		[HttpStatus.BAD_GATEWAY]: status.UNKNOWN,
		[HttpStatus.SERVICE_UNAVAILABLE]: status.UNAVAILABLE,
		[HttpStatus.GATEWAY_TIMEOUT]: status.DEADLINE_EXCEEDED,
		[HttpStatus.HTTP_VERSION_NOT_SUPPORTED]: status.UNAVAILABLE,
		[HttpStatus.PAYLOAD_TOO_LARGE]: status.OUT_OF_RANGE,
		[HttpStatus.UNSUPPORTED_MEDIA_TYPE]: status.CANCELLED,
		[HttpStatus.UNPROCESSABLE_ENTITY]: status.CANCELLED,
		[HttpStatus.I_AM_A_TEAPOT]: status.UNKNOWN,
		[HttpStatus.METHOD_NOT_ALLOWED]: status.CANCELLED,
		[HttpStatus.PRECONDITION_FAILED]: status.FAILED_PRECONDITION,
	};

	catch(exception: Error, host: ArgumentsHost) {
		const contextType = host.getType<ContextType>();
		if (contextType !== 'rpc') throw exception;

		this.logger.error(
			`[${this.constructor.name}] Exception Caught - ${exception.message}`,
			'',
			exception.stack,
		);

		return throwError(() => ({
			code: this.getCode(exception),
			message: this.getMessage(exception),
			details: this.getDetails(exception),
		}));
	}

	private getCode(exception: Error): status {
		if (exception instanceof HttpException)
			return GlobalRpcExceptionFilter.HttpStatusCode[exception.getStatus()] ?? status.UNKNOWN;
		return status.UNKNOWN;
	}

	private getMessage(exception: Error): string {
		if (exception instanceof HttpException) {
			const httpRes = exception.getResponse() as {
				details?: unknown;
				message: string;
			};
			return httpRes.message ?? exception.message;
		}
		return exception.message;
	}

	private getDetails(exception: Error): string {
		if (exception instanceof HttpException) {
			const httpRes = exception.getResponse() as {
				details?: unknown;
				message: string;
			};
			return Array.isArray(httpRes.details) ? httpRes.details.join(', ') : httpRes.message;
		}
		return "Check the app's log";
	}
}
