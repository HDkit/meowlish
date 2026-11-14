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

/** More topic rooms so the room list has a second page (one short conversation each). */
const TOPIC_ROOMS: [string, string[]][] = [
	[
		'ielts-writing-task-2',
		[
			'Ai chữa giúp mình mở bài Task 2 với?',
			'Gửi lên đây mình xem nhé.',
			'Nhớ nêu rõ quan điểm ngay đoạn mở bài.',
		],
	],
	[
		'ielts-speaking-partner',
		['Tìm bạn luyện Speaking buổi tối.', 'Mình nè, 8h tối được không?', 'Ok, luyện Part 2 nhé.'],
	],
	[
		'toeic-part-7-reading',
		[
			'Part 7 mình toàn hết giờ.',
			'Đọc câu hỏi trước rồi mới đọc bài.',
			'Thử áp dụng xem sao, cảm ơn!',
		],
	],
	[
		'toeic-listening-tips',
		[
			'Part 3 nghe nhanh quá.',
			'Đọc trước câu hỏi trong lúc nghe hướng dẫn.',
			'Hay đấy, mai mình thử.',
		],
	],
	[
		'ngu-phap-hang-ngay',
		['Hôm nay ôn thì hiện tại hoàn thành.', 'Have/has + V3, đúng không ạ?', 'Chuẩn rồi!'],
	],
	[
		'tu-vung-moi-ngay',
		[
			'Từ của ngày: resilient — kiên cường.',
			'Đặt câu: She is resilient after failures.',
			'Hay quá!',
		],
	],
	[
		'phat-am-chuan',
		['Mình hay đọc sai âm /θ/.', 'Đặt lưỡi giữa hai hàm răng nhé.', 'Think, three, thank…'],
	],
	[
		'luyen-de-cuoi-tuan',
		['Cuối tuần này làm full test TOEIC không?', 'Có, 9h sáng Chủ nhật.', 'Hẹn nhé!'],
	],
	[
		'goc-hoi-dap',
		[
			'Phân biệt affect và effect thế nào?',
			'Affect là động từ, effect thường là danh từ.',
			'Rõ rồi, cảm ơn bạn.',
		],
	],
	[
		'english-for-work',
		[
			'Email xin nghỉ phép viết sao cho lịch sự?',
			'"I would like to request a day off on…"',
			'Cảm ơn nha.',
		],
	],
	[
		'doc-sach-tieng-anh',
		['Mọi người đang đọc sách gì?', 'Mình đọc "Atomic Habits" bản tiếng Anh.', 'Nghe hay đó!'],
	],
	[
		'phim-va-series',
		[
			'Xem phim có phụ đề Anh có giúp không?',
			'Có, nhất là khi nghe lại từng đoạn.',
			'Mình đang xem Friends.',
		],
	],
	[
		'nhom-hoc-sinh-vien',
		['Có bạn nào ôn thi đầu ra B1 không?', 'Mình nè!', 'Lập nhóm ôn chung đi.'],
	],
	[
		'du-hoc-va-hoc-bong',
		['IELTS bao nhiêu thì xin học bổng được?', 'Thường từ 6.5 trở lên.', 'Phải cố gắng thôi.'],
	],
	[
		'tieng-anh-giao-tiep',
		['Nói "tôi hiểu rồi" tự nhiên hơn thế nào?', '"Got it" hoặc "Makes sense".', 'Cảm ơn bạn!'],
	],
	[
		'flashcard-chia-se',
		[
			'Mình vừa công khai bộ từ vựng Marketing.',
			'Lưu về rồi, cảm ơn nha!',
			'Có góp ý gì cứ đề xuất thay đổi nhé.',
		],
	],
	[
		'dong-luc-hoc-tap',
		['Chuỗi 10 ngày rồi mọi người ơi!', 'Giỏi quá, giữ vững nhé.', 'Mình mới được 3 ngày thôi.'],
	],
	[
		'ielts-reading-hard',
		[
			'True/False/Not Given khó quá.',
			'Not Given là khi bài không nhắc tới.',
			'Mình hay nhầm với False.',
		],
	],
	[
		'toeic-900',
		['Mục tiêu 900 TOEIC, cần lộ trình.', 'Luyện Part 5, 6 thật chắc trước.', 'Ok, cảm ơn anh.'],
	],
	['tro-chuyen-tu-do', ['Hello everyone!', 'Hi! How are you today?', "I'm good, thanks."]],
];

async function main() {
	for (const [name, messages] of TOPIC_ROOMS) {
		ROOMS.push({ name: name, scheduledLiveUrl: null, scheduledTime: null, logs: messages });
	}
	for (const room of ROOMS) {
		const existing = await prisma.room.findUnique({ where: { name: room.name } });
		if (existing) {
			console.warn(`Room "${room.name}" already exists, skipping`);
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
		console.warn(`Created room "${created.name}" with ${room.logs.length} messages`);
	}
	console.warn(`Seeded ${ROOMS.length} rooms`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
