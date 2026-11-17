/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { DynamicModule, Module, OnModuleDestroy, OnModuleInit, Provider } from '@nestjs/common';

export const DATABASE_SERVICE = Symbol('DATABASE_SERVICE');

/**
 * Prisma schemas read `env("POSTGRES_URL")`, but deployments (docker/.env.services,
 * compose) only provide the discrete POSTGRES_* vars. Use POSTGRES_URL when set,
 * otherwise assemble it from the parts so both setups work.
 */
export const resolveDatabaseUrl = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
	if (env['POSTGRES_URL']) return env['POSTGRES_URL'];

	const {
		POSTGRES_HOST: host,
		POSTGRES_PORT: port,
		POSTGRES_USER: user,
		POSTGRES_PASSWORD: password,
		POSTGRES_DB: db,
	} = env;
	if (!host || !user || !db) return undefined;

	const auth = `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ''}`;
	return `postgresql://${auth}@${host}:${port ?? 5432}/${encodeURIComponent(db)}?schema=public`;
};

@Module({})
export class DatabaseModule {
	static forRoot<T extends new (...args: any[]) => any>(PrismaClientClass: T): DynamicModule {
		class AutoPrismaClient extends PrismaClientClass implements OnModuleInit, OnModuleDestroy {
			// mixin constructors must take `...args: any[]`; Nest passes none
			constructor(...args: any[]) {
				const datasourceUrl = resolveDatabaseUrl();
				super(
					...(args.length > 0 ?
						args
					:	[datasourceUrl ? { datasourceUrl: datasourceUrl } : undefined]),
				);
			}

			async onModuleInit() {
				if (super['$connect']) {
					await (this as any).$connect();
				}
			}

			async onModuleDestroy() {
				if (super['$disconnect']) {
					await (this as any).$disconnect();
				}
			}
		}

		const provider: Provider = {
			provide: DATABASE_SERVICE,
			useClass: AutoPrismaClient,
		};

		return {
			module: DatabaseModule,
			providers: [provider],
			exports: [DATABASE_SERVICE],
		};
	}
}
