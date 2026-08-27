import { PrismaClient } from '@prisma-client/notification';

const prisma = new PrismaClient();

async function main() {
	const identities = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM identities`.catch(
		() => [],
	);

	if (identities.length === 0) {
		console.log('No identities found, connecting to auth_db...');
	}

	const userIds =
		identities.length > 0 ?
			identities.map(i => i.id)
		:	[
				'admin',
				'8ac3508e-d8bc-425f-9b4d-04461d9bd0ec',
				'4292d890-805f-4fca-b007-8ce887d87f3d',
				'f5553ed6-6eac-4be8-af62-fbb4226f2e9f',
				'2261ce28-2f42-4420-b5af-580f8d4b8abe',
				'3a2fbb54-984f-4318-bff0-218dc2a9f12c',
			];

	const notifications = userIds.flatMap((recipientId, i) => [
		{
			recipientId: recipientId,
			type: 'system',
			title: 'Chào mừng bạn đến với nền tảng!',
			message: 'Cảm ơn bạn đã đăng ký. Hãy khám phá các tính năng học tập thú vị nhé!',
			data: { action: '/dashboard' },
		},
		{
			recipientId: recipientId,
			type: 'achievement',
			title: 'Thành tích mới!',
			message: 'Bạn đã hoàn thành bài học đầu tiên. Hãy tiếp tục phát huy nhé!',
			data: { badge: 'first_lesson' },
		},
		{
			recipientId: recipientId,
			type: 'system',
			title: 'Cập nhật hệ thống',
			message: 'Nền tảng vừa được cập nhật với nhiều tính năng mới. Hãy trải nghiệm ngay!',
			data: { version: '2.0' },
		},
		{
			recipientId: recipientId,
			type: 'report',
			title: 'Báo cáo học tập',
			message: 'Tuần này bạn đã học được 5 bài mới. Tiến bộ rõ rệt!',
			data: { lessonsCompleted: 5, week: 12 },
		},
		{
			recipientId: recipientId,
			type: 'system',
			title: 'Mẹo học tập',
			message: 'Học từ vựng mỗi ngày 10 từ sẽ giúp bạn cải thiện đáng kể vốn từ vựng sau 1 tháng.',
			data: { tip: 'daily_vocab' },
		},
	]);

	for (const n of notifications) {
		await prisma.notification.upsert({
			where: { id: n.recipientId + n.type + n.title },
			update: {},
			create: {
				id: `${n.recipientId}-${n.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				...n,
				isRead: Math.random() > 0.5,
				readAt: Math.random() > 0.5 ? new Date() : null,
			},
		});
	}

	// Seed notification preferences
	for (const id of userIds) {
		await prisma.notificationPreference.upsert({
			where: { identityId: id },
			update: {},
			create: {
				identityId: id,
				emailEnabled: true,
				pushEnabled: true,
				achievementEnabled: true,
				reportEnabled: true,
				systemEnabled: true,
			},
		});
	}

	console.log(`Seeded ${notifications.length} notifications and ${userIds.length} preferences`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
