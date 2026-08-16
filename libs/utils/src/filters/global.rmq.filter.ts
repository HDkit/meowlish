import { RABBIT_CONTEXT_TYPE_KEY } from '@golevelup/nestjs-rabbitmq';
import { ArgumentsHost, Catch, ContextType, ExceptionFilter } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';

@Catch()
export class GlobalRmqExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: AppLoggerService) {}

	catch(exception: Error, host: ArgumentsHost) {
		const contextType = host.getType<ContextType | typeof RABBIT_CONTEXT_TYPE_KEY>();
		if (contextType !== RABBIT_CONTEXT_TYPE_KEY) throw exception;

		this.logger.error(
			`[${this.constructor.name}] Exception Caught - ${exception.message}`,
			'',
			exception.stack,
		);

		// let the lib handler does their work
		throw exception;
	}
}
