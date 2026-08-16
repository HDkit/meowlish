import { ArgumentsHost, Catch, ContextType, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { AppLoggerService } from '@server/logger';
import { Socket } from 'socket.io';

@Catch()
export class GlobalWsExceptionFilter extends BaseWsExceptionFilter {
	constructor(private readonly logger: AppLoggerService) {
		super();
	}

	override catch(exception: Error, host: ArgumentsHost) {
		const contextType = host.getType<ContextType>();
		if (contextType !== 'ws') throw exception;

		const client: Socket = host.switchToWs().getClient();

		const error = this.getMessage(exception);

		this.logger.error(
			`[${this.constructor.name}] Exception Caught - ${error}`,
			'',
			exception.stack,
		);

		client.emit('exception', {
			status: 'error',
			message: error,
		});
	}

	private getMessage(exception: Error): string {
		if (exception instanceof HttpException) {
			const httpRes = exception.getResponse() as {
				details?: unknown;
				message: string;
			};
			return httpRes.message ?? exception.message;
		}
		return exception instanceof WsException ?
				JSON.stringify(exception.getError())
			:	(exception.message ?? JSON.stringify(exception));
	}
}
