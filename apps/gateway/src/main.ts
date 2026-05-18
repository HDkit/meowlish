import { GatewayModule } from './gateway.module';
import { INestApplicationContext, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const gatewayModule = await NestFactory.create<NestExpressApplication>(GatewayModule, {
		bufferLogs: true,
	});
	gatewayModule.setGlobalPrefix('api');
	gatewayModule.enableVersioning({
		defaultVersion: '1',
		type: VersioningType.URI,
	});
	gatewayModule.enableCors();
	useLogger(gatewayModule);

	// HTTP API docs
	const docConfig = new DocumentBuilder().setVersion('1').addBearerAuth().build();
	const document = SwaggerModule.createDocument(gatewayModule, docConfig);
	gatewayModule.use(
		'/reference',
		apiReference({
			content: document,
		}),
	);

	await gatewayModule.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
