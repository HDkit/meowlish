import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export interface ErrorMessage {
	[key: string]: string;
}

export class ResponseEntity<T> {
	@Expose()
	@ApiProperty({
		description: 'API path',
		example: '/auth/login',
	})
	/** API path */
	path: string;

	@Expose()
	@ApiProperty({
		description: 'HTTP status code',
		example: 200,
	})
	/** HTTP status code */
	statusCode: number;

	@Expose()
	@ApiProperty({
		description: 'Request success status',
		example: true,
	})
	/** Request success status */
	success: boolean;

	@Expose()
	@ApiProperty({
		description: 'Response timestamp',
		example: Date.now(),
	})
	/** Response timestamp */
	timestamp: Date | string | number;

	@Expose()
	@ApiPropertyOptional({
		description: 'Error message if any',
		example: 'Unauthorized',
	})
	/** Error message if there's one */
	error?: string | ErrorMessage;

	@Expose()
	@ApiProperty({
		description: 'Response payload, null if error and in special cases',
		nullable: true,
	})
	/** Set as null if there's error */
	data: T | null;

	constructor(res: ResponseEntity<T>) {
		this.path = res.path;
		this.statusCode = res.statusCode;
		this.success = res.success;
		this.timestamp = res.timestamp || Date.now();
		this.data = res.data;
		this.error = res.error;
	}
}
