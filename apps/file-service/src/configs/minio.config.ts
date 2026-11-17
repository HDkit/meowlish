import { IEnvVars } from './config';
import { ConfigService } from '@nestjs/config';
import { NestMinioOptions } from 'nestjs-minio';

export const minioConfig = (configService: ConfigService<IEnvVars>): NestMinioOptions => {
	const env = configService.getOrThrow('env', { infer: true });
	const minioEnvs = configService.getOrThrow('objStorage', { infer: true });

	return {
		endPoint: minioEnvs.host,
		port: minioEnvs.port,
		accessKey: minioEnvs.user,
		secretKey: minioEnvs.password,
		useSSL: minioEnvs.useSSL ?? env === 'production',
	};
};
