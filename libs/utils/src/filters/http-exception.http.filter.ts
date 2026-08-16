import { ResponseEntity } from '../data/response-entity.type';
import { BadRequestException, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ContextType } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	constructor(
		// private readonly i18n: I18nService,
		private readonly logger: AppLoggerService,
	) {}

	catch(exception: HttpException, host: ArgumentsHost) {
		const contextType = host.getType<ContextType>();
		if (contextType !== 'http') throw exception;

		const ctx = host.switchToHttp();
		const res = ctx.getResponse<Response>();
		const req = ctx.getRequest<Request>();

		const resolved = this.resolve(exception, req);

		this.logger.error(
			`[${this.constructor.name}] Exception Caught - ${req.method} ${req.url} ${exception.message}`,
			'',
			exception.stack,
		);

		return res.status(resolved.statusCode).json(resolved);
	}

	private resolve(exception: HttpException, req: Request): ResponseEntity<null> {
		const excRes = exception.getResponse();
		let message =
			typeof excRes === 'string' ? excRes
			: 'message' in excRes ? (excRes.message as string)
			: 'Unable to parse HttpException message';

		// "for mongoId"
		if (exception instanceof BadRequestException && message.includes('Invalid ObjectId')) {
			message = 'Invalid id format, id is a 24 character hexadecimal string';
		}

		// const translatedMessage = this.i18n.translate('common.ERROR_MESSAGE', {
		// 	lang: req.headers['accept-language'] || 'en',
		// 	args: { message: message },
		// });

		return new ResponseEntity<null>({
			path: req.url,
			statusCode: exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR,
			data: null,
			error: message || 'Internal server error',
			timestamp: Date.now(),
			success: false,
		});
	}
}
