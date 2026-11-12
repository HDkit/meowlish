import { InboxService } from './inbox.service';
import { MessagingModule } from './messaging.module';
import { OutboxPublisher } from './outbox.publisher';
import { MESSAGING_PRISMA, OUTBOX_RELAY_OPTIONS, OutboxRelay } from './outbox.relay';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';

const PRISMA = Symbol('PRISMA');
const fakePrisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };

@Module({ providers: [{ provide: PRISMA, useValue: fakePrisma }], exports: [PRISMA] })
class FakeDatabaseModule {}

@Global()
@Module({
	providers: [{ provide: AmqpConnectionManager, useValue: { getChannels: jest.fn() } }],
	exports: [AmqpConnectionManager],
})
class FakeAmqpModule {}

const fakeAdapter = {
	connectionToken: PRISMA,
	defaultTxOptions: {},
	optionsFactory: (conn: typeof fakePrisma) => ({
		wrapWithTransaction: (
			_o: unknown,
			fn: () => Promise<unknown>,
			setTx: (c?: unknown) => void,
		) => {
			setTx(conn);
			return fn();
		},
		getFallbackInstance: () => conn,
	}),
};

async function build(relay: boolean) {
	return Test.createTestingModule({
		imports: [
			FakeAmqpModule,
			ClsModule.forRoot({
				global: true,
				plugins: [
					new ClsPluginTransactional({
						imports: [FakeDatabaseModule],
						adapter: fakeAdapter as never,
					}),
				],
			}),
			MessagingModule.forRoot({
				serviceName: 'svc',
				prismaToken: PRISMA,
				relay,
				imports: [FakeDatabaseModule],
			}),
		],
	}).compile();
}

describe('MessagingModule', () => {
	it('provides publisher, inbox and relay by default', async () => {
		const mod = await build(true);
		expect(mod.get(OutboxPublisher)).toBeInstanceOf(OutboxPublisher);
		expect(mod.get(InboxService)).toBeInstanceOf(InboxService);
		expect(mod.get(OutboxRelay)).toBeInstanceOf(OutboxRelay);
		expect(mod.get(MESSAGING_PRISMA, { strict: false })).toBe(fakePrisma);
		expect(mod.get(OUTBOX_RELAY_OPTIONS, { strict: false })).toEqual({
			serviceName: 'svc',
			connectionName: 'pub',
		});
	});

	it('does not provide OutboxRelay when relay is false', async () => {
		const mod = await build(false);
		expect(mod.get(OutboxPublisher)).toBeInstanceOf(OutboxPublisher);
		expect(mod.get(InboxService)).toBeInstanceOf(InboxService);
		expect(() => mod.get(OutboxRelay, { strict: false })).toThrow();
	});
});
