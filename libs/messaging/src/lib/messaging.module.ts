import { INBOX_OPTIONS, InboxService } from './inbox.service';
import { OutboxPublisher } from './outbox.publisher';
import { MESSAGING_PRISMA, OUTBOX_RELAY_OPTIONS, OutboxRelay } from './outbox.relay';
import { DynamicModule, Module, ModuleMetadata, Provider } from '@nestjs/common';

export interface MessagingModuleOptions {
	serviceName: string;
	/** Token of the Prisma client (resolved via `imports`). */
	prismaToken: string | symbol;
	/** RabbitMQ connection name, default 'pub'. */
	connectionName?: string;
	/** Run the outbox relay in this process, default true. */
	relay?: boolean;
	/** Modules that provide `prismaToken` (e.g. the app's DatabaseModule). */
	imports?: ModuleMetadata['imports'];
}

@Module({})
export class MessagingModule {
	static forRoot(options: MessagingModuleOptions): DynamicModule {
		const providers: Provider[] = [
			{ provide: MESSAGING_PRISMA, useExisting: options.prismaToken },
			{ provide: INBOX_OPTIONS, useValue: { serviceName: options.serviceName } },
			{
				provide: OUTBOX_RELAY_OPTIONS,
				useValue: {
					serviceName: options.serviceName,
					connectionName: options.connectionName ?? 'pub',
				},
			},
			OutboxPublisher,
			InboxService,
		];
		if (options.relay ?? true) providers.push(OutboxRelay);

		return {
			module: MessagingModule,
			imports: options.imports ?? [],
			providers: providers,
			exports: [OutboxPublisher, InboxService],
		};
	}
}
