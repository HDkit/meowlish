import { IEnvVars } from './config';
import { BullRootModuleOptions } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const bullConfig = (configService: ConfigService<IEnvVars>): BullRootModuleOptions => {
	const redisConfig = configService.getOrThrow('redis', { infer: true });
	return {
		connection: { host: redisConfig.host, port: redisConfig.port },
	};
};
