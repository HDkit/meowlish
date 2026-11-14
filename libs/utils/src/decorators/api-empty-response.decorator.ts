import { ResponseEntity } from '../data';
import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiEmptyResponseEntity = () => {
	return applyDecorators(
		ApiExtraModels(ResponseEntity),
		ApiOkResponse({
			schema: {
				allOf: [
					{ $ref: getSchemaPath(ResponseEntity) },
					{
						properties: {
							data: {
								type: 'null',
								nullable: true,
							},
						},
					},
				],
			},
		}),
	);
};
