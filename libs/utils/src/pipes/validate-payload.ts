import { GlobalValidationPipe } from './validation.pipe';
import { type Type } from '@nestjs/common';

const pipe = new GlobalValidationPipe();

/**
 * Validates and transforms an untyped payload (e.g. an unwrapped event) the same way the global
 * validation pipe treats a typed handler parameter. Throws `BadRequestException` when invalid.
 */
export async function validatePayload<T extends object>(
	metatype: Type<T>,
	payload: unknown,
): Promise<T> {
	return (await pipe.transform(payload, { type: 'body', metatype: metatype })) as T;
}
