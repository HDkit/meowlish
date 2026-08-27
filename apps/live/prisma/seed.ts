import { PrismaClient } from '@prisma-client/live';

const prisma = new PrismaClient();

const USER_IDS = [
	'admin',
	'8ac3508e-d8bc-425f-9b4d-04461d9bd0ec',
	'4292d890-805f-4fca-b007-8ce887d87f3d',
	'f5553ed6-6eac-4be8-af62-fbb4226f2e9f',
	'2261ce28-2f42-4420-b5af-580f8d4b8abe',
	'3a2fbb54-984f-4318-bff0-218dc2a9f12c',
	'c14da81d-0fee-4520-b2ff-fe80141d786e',
	'0833eda1-18e0-4f74-b774-158cea662100',
	'ff8aafa4-7715-4806-9d29-a46807de020d',
	'70b51742-b20a-43bf-9a5c-6d7c9aef7bba',
];

const ROOMS = [
	{
		name: 'phong-tro-chuyen-tieng-anh',
		scheduledLiveUrl: null,
		scheduledTime: null,
		logs: [
			'Chào mọi người! Hôm nay học gì thế?',
			'Mình đang học từ vựng về chủ đề ẩm thực.',
			'Hay quá! Chia sẻ vài từ mới đi bạn.',
			'Delicious - ngon, tasty - có vị ngon, savory - mặn mà.',
			'Cảm ơn bạn! Mình ghi chép lại ngay.',
		],
	},
	{
		name: 'luyen-noi-tieng-anh',
		scheduledLiveUrl: null,
		scheduledTime: null,
		logs: [
			'Ai muốn luyện nói cùng mình không?',
			'Mình cũng muốn luyện phát âm chuẩn hơn.',
			'Hay quá! Chủ đề gì hôm nay?',
			'Nói về sở thích cá nhân nhé.',
			'Mình thích đọc sách và nghe nhạc.',
		],
	},
	{
		name: 'hoc-ngu-phap-co-ban',
		scheduledLiveUrl: null,
		scheduledTime: null,
		logs: [
			'Thì hiện tại đơn dùng khi nào vậy mọi người?',
			'Dùng để diễn tả thói quen hoặc sự thật hiển nhiên.',
			'Ví dụ: The sun rises in the East.',
			'Mình hiểu rồi! Cảm ơn bạn.',
			'Có ai giải thích thì hiện tại tiếp diễn không?',
		],
	},
	{
		name: 'english-grammar-club',
		scheduledLiveUrl: 'https://zoom.us/j/example',
		scheduledTime: new Date(Date.now() + 86400000 * 3),
		logs: [
			'Buổi học ngữ pháp tuần này về câu điều kiện nhé.',
			'Câu điều kiện loại 1: If + S + V(s/es), S + will + V.',
			'Cho ví dụ được không ạ?',
			'If it rains, I will stay at home.',
			'Dễ hiểu quá! Cảm ơn thầy.',
		],
	},
	{
		name: 'phong-luyen-thi-ielts',
		scheduledLiveUrl: null,
		scheduledTime: null,
		logs: [
			'Mình sắp thi IELTS rồi, lo quá!',
			'Bạn luyện phần nào rồi?',
			'Mình yếu speaking nhất.',
			'Hãy luyện nói trước gương và ghi âm lại nhé.',
			'Cảm ơn lời khuyên! Mình sẽ cố gắng.',
		],
	},
];

async function main() {
	for (const room of ROOMS) {
		const existing = await prisma.room.findUnique({ where: { name: room.name } });
		if (existing) {
			console.log(`Room "${room.name}" already exists, skipping`);
			continue;
		}

		const created = await prisma.room.create({
			data: {
				name: room.name,
				scheduledLiveUrl: room.scheduledLiveUrl,
				scheduledTime: room.scheduledTime,
				logs: {
					create: room.logs.map((msg, i) => ({
						fromId: USER_IDS[i % USER_IDS.length],
						message: msg,
						createdAt: new Date(Date.now() - (room.logs.length - i) * 60000),
					})),
				},
			},
		});
		console.log(`Created room "${created.name}" with ${room.logs.length} messages`);
	}
	console.log(`Seeded ${ROOMS.length} rooms`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
