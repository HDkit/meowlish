import { PrismaClient } from '@prisma-client/resource';

const prisma = new PrismaClient();

const USER_IDS = [
	'admin',
	'8ac3508e-d8bc-425f-9b4d-04461d9bd0ec',
	'4292d890-805f-4fca-b007-8ce887d87f3d',
	'f5553ed6-6eac-4be8-af62-fbb4226f2e9f',
	'2261ce28-2f42-4420-b5af-580f8d4b8abe',
	'3a2fbb54-984f-4318-bff0-218dc2a9f12c',
];

const BLOGS = [
	{
		title: 'Cách học tiếng Anh hiệu quả mỗi ngày',
		content:
			'Học tiếng Anh không khó nếu bạn có phương pháp đúng đắn. Hãy dành 30 phút mỗi ngày để luyện nghe, nói, đọc, viết. Quan trọng nhất là sự kiên trì và thực hành thường xuyên. Bắt đầu với những chủ đề đơn giản và tăng dần độ khó.',
		tags: ['tieng-anh', 'hoc-tap', 'phuong-phap'],
	},
	{
		title: '5 lỗi thường gặp khi phát âm tiếng Anh',
		content:
			'Người Việt thường gặp khó khăn với các âm /θ/, /ð/, /ʃ/, /ʒ/. Cách khắc phục tốt nhất là luyện tập trước gương và ghi âm lại giọng đọc của mình để so sánh với người bản xứ.',
		tags: ['phat-am', 'tieng-anh', 'luyen-tap'],
	},
	{
		title: 'Từ vựng tiếng Anh chủ đề công sở',
		content:
			'Dưới đây là những từ vựng thông dụng trong môi trường công sở: meeting (cuộc họp), deadline (hạn chót), collaborate (hợp tác), presentation (bài thuyết trình), và many more!',
		tags: ['tu-vung', 'cong-so', 'tieng-anh'],
	},
	{
		title: 'Làm thế nào để viết email chuyên nghiệp bằng tiếng Anh',
		content:
			'Một email chuyên nghiệp cần có tiêu đề rõ ràng, lời chào phù hợp, nội dung ngắn gọn và kết thúc lịch sự. Đừng quên kiểm tra chính tả trước khi gửi!',
		tags: ['email', 'viet-lach', 'tieng-anh'],
	},
	{
		title: 'Bí quyết luyện nghe tiếng Anh qua podcast',
		content:
			'Podcast là công cụ tuyệt vời để luyện nghe tiếng Anh. Hãy chọn những chủ đề bạn yêu thích, nghe có phụ đề trước, sau đó nghe lại không phụ đề và ghi chép lại những gì bạn hiểu được.',
		tags: ['nghe', 'podcast', 'tieng-anh'],
	},
];

const FLASHCARD_LISTS = [
	{
		name: 'Từ vựng giao tiếp hàng ngày',
		description: 'Những từ và cụm từ thông dụng trong giao tiếp hàng ngày',
		isPublic: true,
		tags: ['giao-tiep', 'co-ban'],
		cards: [
			{ word: 'Hello', definition: 'Xin chào', examples: ['Hello, how are you?'] },
			{ word: 'Goodbye', definition: 'Tạm biệt', examples: ['Goodbye, see you tomorrow!'] },
			{ word: 'Thank you', definition: 'Cảm ơn', examples: ['Thank you for your help.'] },
			{ word: 'Sorry', definition: 'Xin lỗi', examples: ['I am sorry for being late.'] },
			{ word: 'Please', definition: 'Làm ơn', examples: ['Please pass me the salt.'] },
		],
	},
	{
		name: 'Từ vựng về thời tiết',
		description: 'Các từ vựng miêu tả thời tiết bằng tiếng Anh',
		isPublic: true,
		tags: ['thoi-tiet', 'tu-vung'],
		cards: [
			{ word: 'Sunny', definition: 'Nắng', examples: ['It is a sunny day.'] },
			{ word: 'Rainy', definition: 'Mưa', examples: ['I love rainy days.'] },
			{ word: 'Cloudy', definition: 'Nhiều mây', examples: ['It looks cloudy outside.'] },
		],
	},
	{
		name: 'Động từ bất quy tắc',
		description: 'Các động từ bất quy tắc thường gặp',
		isPublic: false,
		tags: ['dong-tu', 'ngu-phap'],
		cards: [
			{ word: 'Go', definition: 'Đi (went - gone)', examples: ['I go to school every day.'] },
			{ word: 'Eat', definition: 'Ăn (ate - eaten)', examples: ['I ate breakfast at 7am.'] },
			{ word: 'Write', definition: 'Viết (wrote - written)', examples: ['She wrote a letter.'] },
		],
	},
];

async function main() {
	// Seed blogs
	for (const blog of BLOGS) {
		const authorId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
		await prisma.blog.create({
			data: {
				title: blog.title,
				content: blog.content,
				authorId: authorId,
				tags: blog.tags,
			},
		});
	}

	// Seed flashcard lists with cards
	for (const list of FLASHCARD_LISTS) {
		const authorId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
		const created = await prisma.flashCardList.create({
			data: {
				name: list.name,
				description: list.description,
				authorId: authorId,
				isPublic: list.isPublic,
				tags: list.tags,
				cards: {
					create: list.cards.map(card => ({
						word: card.word,
						definition: card.definition,
						authorId: authorId,
						tags: [],
						examples: card.examples,
					})),
				},
			},
		});
		console.log(`Created list "${created.name}" with ${list.cards.length} cards`);
	}

	console.log(`Seeded ${BLOGS.length} blogs and ${FLASHCARD_LISTS.length} flashcard lists`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
