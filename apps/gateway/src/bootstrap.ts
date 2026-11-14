import { type IEnvVars } from './configs/config';
import { corsOptions } from './cors';
import { GatewayModule } from './gateway.module';
import { LiveWsGatewayController } from './live-ws-gateway/live-ws.router.controller';
import { INestApplicationContext, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	gatewayModule.set('query parser', 'extended');
	gatewayModule.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
	gatewayModule.enableVersioning({
		defaultVersion: '1',
		type: VersioningType.URI,
	});
	const configService = gatewayModule.get<ConfigService<IEnvVars>>(ConfigService);
	const server = configService.getOrThrow('server', { infer: true });
	// only honour X-Forwarded-For (rate-limit client IP) when explicitly behind a trusted proxy
	gatewayModule.set('trust proxy', configService.getOrThrow('trustProxy', { infer: true }));
	gatewayModule.enableCors(corsOptions(configService.getOrThrow('corsOrigins', { infer: true })));
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

	// socket.io WebSocket upgrades are proxied from the first connection on (C22)
	const liveWs = gatewayModule.get(LiveWsGatewayController, { strict: false });
	gatewayModule.getHttpServer().on('upgrade', liveWs.handleUpgrade);

	await gatewayModule.listen(server.port, server.host);
}

bootstrap().catch(console.error);
