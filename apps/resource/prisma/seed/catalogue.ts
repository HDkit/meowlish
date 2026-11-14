import { type SeedBlog } from './blogs';
import { type SeedFlashCardList } from './demo-flashcards';
import { SEED_USERS, photo } from './users';

/**
 * Extra posts and public flash card lists so the blog, Discover and the lists have more than one
 * page. Ids are deterministic (`seed-blog-x-*`, `seed-fcl-pub-*`, `seed-fc-pub-*`), so re-seeding
 * updates instead of duplicating.
 */

const COVERS = [
	'1488190211105-8b0e65b80b4e',
	'1434030216411-0b793f4b4173',
	'1478737270239-2f02b77fc618',
	'1497633762265-9d179a990aa6',
	'1501504905252-473c47e087f8',
	'1503676260728-1c00da094a0b',
	'1517842645767-c639042777db',
	'1522202176988-66273c2fd55f',
	'1456513080510-7bf3a84b82f8',
	'1516321318423-f06f85e504b3',
];

const AUTHORS = [
	SEED_USERS.minh,
	SEED_USERS.linh,
	SEED_USERS.duc,
	SEED_USERS.hoa,
	SEED_USERS.tuan,
	SEED_USERS.mai,
	SEED_USERS.admin,
];

type Section = { heading: string; body: string; tip?: string; list?: string[] };

const article = (cover: string, intro: string, sections: Section[]): string =>
	[
		`![](${photo(cover)})`,
		'',
		intro,
		...sections.flatMap(s => [
			'',
			`## ${s.heading}`,
			'',
			s.body,
			...(s.list ? ['', ...s.list.map(item => `- ${item}`)] : []),
			...(s.tip ? ['', `> **Mẹo:** ${s.tip}`] : []),
		]),
	].join('\n');

const POSTS: { slug: string; title: string; tags: string[]; intro: string; sections: Section[] }[] =
	[
		{
			slug: 'shadowing',
			title: 'Shadowing: luyện nghe và nói cùng lúc',
			tags: ['nghe', 'noi'],
			intro:
				'Shadowing là kỹ thuật nghe một đoạn audio và nói lặp lại gần như đồng thời. Chỉ 15 phút mỗi ngày đủ để cải thiện ngữ điệu rõ rệt.',
			sections: [
				{
					heading: 'Chọn tài liệu phù hợp',
					body: 'Bắt đầu với đoạn audio ngắn (1–2 phút), tốc độ vừa phải và có transcript.',
					list: [
						'Podcast cho người học',
						'Đoạn hội thoại trong đề TOEIC Part 3',
						'Bài nói TED ngắn',
					],
				},
				{
					heading: 'Ba bước mỗi buổi',
					body: 'Nghe trọn đoạn một lần, đọc transcript, rồi shadow 3–5 lần cho đến khi theo kịp.',
					tip: 'Ghi âm lần cuối để so sánh với bản gốc.',
				},
			],
		},
		{
			slug: 'toeic-part-5',
			title: 'TOEIC Part 5: 5 dạng ngữ pháp gặp nhiều nhất',
			tags: ['toeic', 'ngu-phap'],
			intro:
				'Part 5 có 30 câu điền từ. Nắm chắc vài dạng lặp lại giúp bạn làm nhanh và để dành thời gian cho Part 7.',
			sections: [
				{
					heading: 'Từ loại',
					body: 'Xác định vị trí trống cần danh từ, động từ, tính từ hay trạng từ dựa vào từ đứng trước và sau.',
					list: [
						'the + ___ + of → danh từ',
						'be + ___ + V3 → trạng từ',
						'a/an + ___ + danh từ → tính từ',
					],
				},
				{
					heading: 'Thì và sự hòa hợp',
					body: 'Tìm dấu hiệu thời gian (since, by the time, next week) và chủ ngữ số ít/số nhiều.',
				},
				{
					heading: 'Giới từ và liên từ',
					body: 'Despite + danh từ, although + mệnh đề — một cặp bẫy quen thuộc.',
					tip: 'Đọc hết câu trước khi nhìn đáp án để không bị đánh lừa.',
				},
			],
		},
		{
			slug: 'writing-task-1',
			title: 'IELTS Writing Task 1: viết phần overview sao cho đủ ý',
			tags: ['ielts', 'viet-lach'],
			intro:
				'Overview là phần giám khảo tìm đầu tiên khi chấm Task Achievement. Thiếu overview, điểm khó vượt 5.0.',
			sections: [
				{
					heading: 'Overview gồm gì?',
					body: 'Hai đặc điểm nổi bật nhất: xu hướng chung và điểm khác biệt lớn nhất. Không đưa số liệu chi tiết.',
				},
				{
					heading: 'Mẫu câu hữu ích',
					body: '"Overall, it is clear that…", "The most striking feature is…"',
					list: [
						'Overall, X increased while Y declined.',
						'It is noticeable that X remained the highest throughout the period.',
					],
				},
			],
		},
		{
			slug: 'phrasal-verbs',
			title: '20 phrasal verb dùng hằng ngày nơi công sở',
			tags: ['tu-vung', 'toeic'],
			intro:
				'Phrasal verb xuất hiện dày đặc trong email và hội thoại công việc. Học theo ngữ cảnh sẽ nhớ lâu hơn học danh sách.',
			sections: [
				{
					heading: 'Họp hành',
					body: 'Những cụm hay nghe trong cuộc họp:',
					list: [
						'bring up — nêu ra (vấn đề)',
						'go over — xem lại',
						'put off — hoãn lại',
						'follow up — theo dõi tiếp',
					],
				},
				{
					heading: 'Email',
					body: 'Viết email lịch sự, tự nhiên hơn với:',
					list: [
						'get back to — phản hồi lại',
						'reach out to — liên hệ',
						'fill in — điền thông tin',
					],
					tip: 'Lưu những cụm này thành một bộ flashcard và ôn mỗi tối.',
				},
			],
		},
		{
			slug: 'reading-skimming',
			title: 'Skimming và scanning trong IELTS Reading',
			tags: ['ielts', 'doc-hieu'],
			intro:
				'Bạn không cần đọc hết từng chữ. Skimming để nắm ý chính, scanning để tìm thông tin cụ thể.',
			sections: [
				{
					heading: 'Khi nào skim?',
					body: 'Câu hỏi Matching Headings và câu hỏi ý chính của đoạn.',
				},
				{
					heading: 'Khi nào scan?',
					body: 'Câu hỏi về tên riêng, năm, con số — tìm từ khóa rồi đọc kỹ câu chứa nó.',
					tip: 'Gạch chân từ khóa trong câu hỏi trước khi đọc bài.',
				},
			],
		},
		{
			slug: 'pronunciation-ed',
			title: 'Phát âm đuôi -ed: ba cách đọc, một quy tắc',
			tags: ['phat-am'],
			intro: 'Đuôi -ed có ba cách đọc: /t/, /d/ và /ɪd/. Chỉ cần nhìn âm cuối của động từ gốc.',
			sections: [
				{
					heading: 'Quy tắc',
					body: '/ɪd/ sau âm /t/ /d/; /t/ sau âm vô thanh; /d/ trong các trường hợp còn lại.',
					list: ['wanted, needed → /ɪd/', 'stopped, laughed → /t/', 'played, cleaned → /d/'],
				},
			],
		},
		{
			slug: 'study-plan-30-days',
			title: 'Kế hoạch 30 ngày tăng 100 điểm TOEIC',
			tags: ['toeic', 'phuong-phap'],
			intro: 'Một lộ trình cụ thể cho người đang ở khoảng 500–600 điểm muốn lên 650–700.',
			sections: [
				{
					heading: 'Tuần 1–2: nền tảng',
					body: 'Mỗi ngày 30 phút ngữ pháp Part 5 và 20 từ vựng mới.',
				},
				{
					heading: 'Tuần 3: luyện đề theo phần',
					body: 'Làm riêng Part 3, 4 và Part 7, chép lại câu sai.',
				},
				{
					heading: 'Tuần 4: đề đầy đủ',
					body: 'Hai đề full test, chấm và phân tích loại câu sai nhiều nhất.',
					tip: 'Xem trang Tiến độ để biết dạng câu bạn yếu nhất.',
				},
			],
		},
		{
			slug: 'speaking-part-2',
			title: 'IELTS Speaking Part 2: nói đủ 2 phút không bí ý',
			tags: ['ielts', 'noi'],
			intro: 'Một phút chuẩn bị là đủ nếu bạn có khung ý sẵn.',
			sections: [
				{
					heading: 'Khung 4 câu hỏi',
					body: 'What – When – Why – How did you feel. Ghi 2–3 từ khóa cho mỗi ý.',
				},
				{
					heading: 'Kéo dài tự nhiên',
					body: 'Thêm ví dụ, so sánh với hiện tại và nêu cảm xúc.',
					tip: 'Luyện với đồng hồ bấm giờ ở trang Luyện Nói.',
				},
			],
		},
		{
			slug: 'collocations',
			title: 'Collocation: vì sao "make a decision" mà không phải "do a decision"',
			tags: ['tu-vung'],
			intro:
				'Collocation là những từ hay đi với nhau. Dùng đúng giúp câu văn tự nhiên và tăng điểm Lexical Resource.',
			sections: [
				{
					heading: 'Make hay do?',
					body: 'Make: tạo ra cái mới (make a plan, make progress). Do: thực hiện việc (do homework, do research).',
				},
				{
					heading: 'Học thế nào?',
					body: 'Học theo cụm, không học từ đơn lẻ, và đặt câu với chính mình.',
				},
			],
		},
		{
			slug: 'listening-traps',
			title: 'Những cái bẫy thường gặp trong TOEIC Listening',
			tags: ['toeic', 'nghe'],
			intro: 'Đề nghe thường cài từ đồng âm và thông tin bị sửa lại ở cuối câu.',
			sections: [
				{
					heading: 'Từ đồng âm',
					body: 'Nghe "copy" nhưng đáp án đúng nói "duplicate" — đáp án lặp nguyên từ thường là bẫy.',
				},
				{
					heading: 'Thông tin bị sửa',
					body: '"The meeting is at 3… actually, let\'s make it 4." Luôn nghe hết câu.',
					tip: 'Đọc trước câu hỏi Part 3, 4 trong lúc nghe phần hướng dẫn.',
				},
			],
		},
		{
			slug: 'linking-words',
			title: 'Từ nối giúp bài Writing mạch lạc hơn',
			tags: ['viet-lach', 'ngu-phap'],
			intro: 'Coherence & Cohesion chiếm 25% điểm Writing. Dùng từ nối đúng chỗ, không nhồi nhét.',
			sections: [
				{
					heading: 'Theo chức năng',
					body: 'Chọn từ nối theo ý muốn diễn đạt:',
					list: [
						'Bổ sung: moreover, in addition',
						'Đối lập: however, on the other hand',
						'Kết quả: therefore, as a result',
					],
				},
			],
		},
		{
			slug: 'daily-habit',
			title: 'Học 15 phút mỗi ngày: thói quen nhỏ, kết quả lớn',
			tags: ['phuong-phap'],
			intro: 'Học đều đặn hiệu quả hơn học dồn. Chuỗi ngày học trên trang Tiến độ là động lực tốt.',
			sections: [
				{
					heading: 'Gắn với thói quen có sẵn',
					body: 'Ôn flashcard sau bữa sáng, nghe podcast trên đường đi làm.',
				},
				{
					heading: 'Đặt mục tiêu tuần',
					body: 'Chọn số ngày học mỗi tuần trong phần Lịch luyện tập và giữ chuỗi.',
				},
			],
		},
		{
			slug: 'email-writing',
			title: 'Viết email công việc bằng tiếng Anh: mẫu và lưu ý',
			tags: ['viet-lach', 'toeic'],
			intro: 'Email ngắn, rõ mục đích và đúng giọng điệu là kỹ năng dùng hằng ngày.',
			sections: [
				{
					heading: 'Cấu trúc',
					body: 'Lời chào → mục đích → chi tiết → hành động mong muốn → lời kết.',
				},
				{
					heading: 'Câu mở đầu',
					body: '"I am writing to…", "Following our conversation…"',
					tip: 'Tránh viết hoa toàn bộ — dễ bị hiểu là đang to tiếng.',
				},
			],
		},
		{
			slug: 'mistakes-review',
			title: 'Cách ôn lại lỗi sai sau mỗi bài thi',
			tags: ['phuong-phap', 'ielts', 'toeic'],
			intro: 'Điểm chỉ tăng khi bạn hiểu vì sao mình sai.',
			sections: [
				{
					heading: 'Phân loại lỗi',
					body: 'Thiếu từ vựng, hiểu sai câu hỏi, hết thời gian hay bẫy đề?',
				},
				{
					heading: 'Biến lỗi thành thẻ',
					body: 'Mỗi từ hay cấu trúc sai thành một flashcard, ôn bằng chế độ Ôn tập.',
				},
			],
		},
	];

export const EXTRA_BLOGS: SeedBlog[] = POSTS.map((p, i) => ({
	id: `seed-blog-x-${p.slug}`,
	title: p.title,
	authorId: AUTHORS[i % AUTHORS.length],
	tags: p.tags,
	content: article(COVERS[i % COVERS.length], p.intro, p.sections),
}));

/** [word, definition, part of speech, example] */
type CardRow = [string, string, string, string];

const LISTS: {
	slug: string;
	name: string;
	description: string;
	tags: string[];
	cards: CardRow[];
}[] = [
	{
		slug: 'travel',
		name: 'Du lịch & sân bay',
		description: 'Từ vựng khi đi máy bay, làm thủ tục và đặt khách sạn.',
		tags: ['Travel', 'TOEIC'],
		cards: [
			['boarding pass', 'thẻ lên máy bay', 'n', 'Please show your boarding pass at the gate.'],
			['delay', 'sự chậm trễ', 'n', 'The flight has a two-hour delay.'],
			['luggage', 'hành lý', 'n', 'Your luggage is over the weight limit.'],
			['check in', 'làm thủ tục', 'v', 'You can check in online.'],
			['itinerary', 'lịch trình', 'n', 'I emailed you the itinerary.'],
		],
	},
	{
		slug: 'health',
		name: 'Sức khỏe & bệnh viện',
		description: 'Từ vựng khám bệnh, triệu chứng và thuốc.',
		tags: ['Health'],
		cards: [
			['symptom', 'triệu chứng', 'n', 'Fever is a common symptom.'],
			['prescription', 'đơn thuốc', 'n', 'The doctor gave me a prescription.'],
			['recover', 'hồi phục', 'v', 'She recovered quickly.'],
			['appointment', 'cuộc hẹn', 'n', 'I have a dental appointment.'],
			['allergy', 'dị ứng', 'n', 'He has a peanut allergy.'],
		],
	},
	{
		slug: 'environment',
		name: 'Môi trường (IELTS)',
		description: 'Chủ đề môi trường hay gặp trong Writing Task 2.',
		tags: ['IELTS', 'Writing'],
		cards: [
			['emission', 'khí thải', 'n', 'Car emissions pollute the air.'],
			['renewable', 'tái tạo được', 'adj', 'Solar power is a renewable energy source.'],
			['deforestation', 'nạn phá rừng', 'n', 'Deforestation threatens wildlife.'],
			['sustainable', 'bền vững', 'adj', 'We need sustainable growth.'],
			['conserve', 'bảo tồn', 'v', 'Conserve water whenever possible.'],
		],
	},
	{
		slug: 'technology',
		name: 'Công nghệ',
		description: 'Từ vựng về công nghệ và mạng xã hội.',
		tags: ['IELTS', 'Vocabulary'],
		cards: [
			['device', 'thiết bị', 'n', 'Turn off all electronic devices.'],
			['innovation', 'sự đổi mới', 'n', 'Innovation drives the economy.'],
			['access', 'truy cập', 'v', 'You can access the files online.'],
			['privacy', 'quyền riêng tư', 'n', 'Social media raises privacy concerns.'],
			['upgrade', 'nâng cấp', 'v', 'Upgrade the software to fix the bug.'],
		],
	},
	{
		slug: 'education',
		name: 'Giáo dục',
		description: 'Chủ đề giáo dục cho IELTS Speaking và Writing.',
		tags: ['IELTS'],
		cards: [
			['curriculum', 'chương trình học', 'n', 'The curriculum includes art.'],
			['tuition', 'học phí', 'n', 'Tuition fees keep rising.'],
			['scholarship', 'học bổng', 'n', 'She won a scholarship.'],
			['graduate', 'tốt nghiệp', 'v', 'He graduated in 2020.'],
			['assignment', 'bài tập', 'n', 'The assignment is due Friday.'],
		],
	},
	{
		slug: 'shopping',
		name: 'Mua sắm',
		description: 'Hội thoại mua bán, đổi trả và thanh toán.',
		tags: ['TOEIC'],
		cards: [
			['receipt', 'hóa đơn', 'n', 'Keep your receipt for returns.'],
			['discount', 'giảm giá', 'n', 'Members get a 10% discount.'],
			['refund', 'hoàn tiền', 'n', 'I would like a refund.'],
			['out of stock', 'hết hàng', 'adj', 'That size is out of stock.'],
			['bargain', 'món hời', 'n', 'This jacket was a bargain.'],
		],
	},
	{
		slug: 'finance',
		name: 'Tài chính & ngân hàng',
		description: 'Từ vựng TOEIC về ngân hàng, ngân sách và hóa đơn.',
		tags: ['TOEIC'],
		cards: [
			['invoice', 'hóa đơn (thanh toán)', 'n', 'Please pay the invoice within 30 days.'],
			['budget', 'ngân sách', 'n', 'We are over budget.'],
			['deposit', 'tiền đặt cọc / gửi tiền', 'n', 'A deposit is required.'],
			['loan', 'khoản vay', 'n', 'They applied for a loan.'],
			['revenue', 'doanh thu', 'n', 'Revenue grew by 5%.'],
		],
	},
	{
		slug: 'food',
		name: 'Ẩm thực',
		description: 'Món ăn, cách nấu và gọi món.',
		tags: ['Daily'],
		cards: [
			['recipe', 'công thức nấu ăn', 'n', 'Can you share the recipe?'],
			['ingredient', 'nguyên liệu', 'n', 'Mix all the ingredients.'],
			['spicy', 'cay', 'adj', 'This soup is too spicy.'],
			['order', 'gọi món', 'v', 'Are you ready to order?'],
			['dessert', 'món tráng miệng', 'n', 'Would you like dessert?'],
		],
	},
	{
		slug: 'job-interview',
		name: 'Phỏng vấn xin việc',
		description: 'Từ và cụm từ dùng trong phỏng vấn.',
		tags: ['Work'],
		cards: [
			['applicant', 'ứng viên', 'n', 'We had fifty applicants.'],
			['qualification', 'bằng cấp, trình độ', 'n', 'What are your qualifications?'],
			['strength', 'điểm mạnh', 'n', 'My strength is teamwork.'],
			['salary', 'lương', 'n', 'The salary is negotiable.'],
			['hire', 'tuyển dụng', 'v', 'They hired two engineers.'],
		],
	},
	{
		slug: 'weather-more',
		name: 'Thời tiết nâng cao',
		description: 'Mô tả thời tiết chi tiết hơn.',
		tags: ['Daily', 'IELTS'],
		cards: [
			['humid', 'ẩm ướt', 'adj', 'It is hot and humid today.'],
			['drizzle', 'mưa phùn', 'n', 'Just a light drizzle.'],
			['forecast', 'dự báo', 'n', 'The forecast says rain.'],
			['freezing', 'lạnh cóng', 'adj', 'It was freezing last night.'],
			['heatwave', 'đợt nắng nóng', 'n', 'The heatwave lasted a week.'],
		],
	},
	{
		slug: 'emotions',
		name: 'Cảm xúc',
		description: 'Diễn tả cảm xúc chính xác hơn "happy" và "sad".',
		tags: ['Speaking'],
		cards: [
			['thrilled', 'cực kỳ vui', 'adj', 'I was thrilled to hear the news.'],
			['anxious', 'lo lắng', 'adj', 'She felt anxious before the exam.'],
			['relieved', 'nhẹ nhõm', 'adj', 'We were relieved it was over.'],
			['frustrated', 'bực bội', 'adj', 'He got frustrated with the delay.'],
			['grateful', 'biết ơn', 'adj', 'I am grateful for your help.'],
		],
	},
	{
		slug: 'idioms',
		name: 'Thành ngữ thông dụng',
		description: 'Thành ngữ hay dùng trong giao tiếp.',
		tags: ['Speaking', 'Vocabulary'],
		cards: [
			['a piece of cake', 'dễ như ăn bánh', 'idiom', 'The test was a piece of cake.'],
			['break the ice', 'phá vỡ sự ngại ngùng', 'idiom', 'He told a joke to break the ice.'],
			['hit the books', 'học chăm chỉ', 'idiom', 'I need to hit the books tonight.'],
			['under the weather', 'không khỏe', 'idiom', 'I am feeling under the weather.'],
			['call it a day', 'kết thúc công việc', 'idiom', "Let's call it a day."],
		],
	},
	{
		slug: 'linking',
		name: 'Từ nối Writing',
		description: 'Từ nối theo chức năng cho bài luận.',
		tags: ['Writing'],
		cards: [
			['moreover', 'hơn nữa', 'adv', 'Moreover, it saves time.'],
			['nevertheless', 'tuy nhiên', 'adv', 'It was hard; nevertheless, we finished.'],
			['consequently', 'do đó', 'adv', 'Consequently, prices rose.'],
			['whereas', 'trong khi đó', 'conj', 'He likes tea, whereas she likes coffee.'],
			['in contrast', 'ngược lại', 'phrase', 'In contrast, sales fell.'],
		],
	},
	{
		slug: 'marketing',
		name: 'Marketing',
		description: 'Từ vựng TOEIC Part 7 về quảng cáo và khách hàng.',
		tags: ['TOEIC', 'Work'],
		cards: [
			['campaign', 'chiến dịch', 'n', 'The ad campaign starts next month.'],
			['target audience', 'khách hàng mục tiêu', 'n', 'Who is our target audience?'],
			['launch', 'ra mắt', 'v', 'We will launch the product in May.'],
			['survey', 'khảo sát', 'n', 'Please complete the survey.'],
			['brand', 'thương hiệu', 'n', 'Brand awareness has grown.'],
		],
	},
	{
		slug: 'transport',
		name: 'Giao thông',
		description: 'Phương tiện và tình huống giao thông.',
		tags: ['Daily'],
		cards: [
			['commute', 'đi làm (hằng ngày)', 'v', 'I commute by bus.'],
			['traffic jam', 'kẹt xe', 'n', 'We were stuck in a traffic jam.'],
			['fare', 'giá vé', 'n', 'The bus fare went up.'],
			['platform', 'sân ga', 'n', 'The train leaves from platform 3.'],
			['detour', 'đường vòng', 'n', 'Take a detour due to roadwork.'],
		],
	},
	{
		slug: 'housing',
		name: 'Nhà ở',
		description: 'Thuê nhà, tiện ích và sửa chữa.',
		tags: ['Daily', 'IELTS'],
		cards: [
			['landlord', 'chủ nhà', 'n', 'Call the landlord about the leak.'],
			['rent', 'tiền thuê', 'n', 'Rent is due on the first.'],
			['utilities', 'các tiện ích (điện, nước)', 'n', 'Utilities are included.'],
			['spacious', 'rộng rãi', 'adj', 'The living room is spacious.'],
			['neighborhood', 'khu dân cư', 'n', 'It is a quiet neighborhood.'],
		],
	},
	{
		slug: 'sports',
		name: 'Thể thao',
		description: 'Từ vựng thể thao và rèn luyện sức khỏe.',
		tags: ['Speaking'],
		cards: [
			['opponent', 'đối thủ', 'n', 'Our opponent was strong.'],
			['tournament', 'giải đấu', 'n', 'They won the tournament.'],
			['work out', 'tập thể dục', 'v', 'I work out three times a week.'],
			['injury', 'chấn thương', 'n', 'He missed the game due to injury.'],
			['referee', 'trọng tài', 'n', 'The referee blew the whistle.'],
		],
	},
	{
		slug: 'academic-verbs',
		name: 'Động từ học thuật',
		description: 'Động từ trang trọng cho IELTS Writing.',
		tags: ['IELTS', 'Writing'],
		cards: [
			['indicate', 'cho thấy', 'v', 'The data indicate a rise.'],
			['contribute', 'đóng góp', 'v', 'Many factors contribute to stress.'],
			['assess', 'đánh giá', 'v', 'Teachers assess progress regularly.'],
			['emphasize', 'nhấn mạnh', 'v', 'The report emphasizes safety.'],
			['undermine', 'làm suy yếu', 'v', 'Lies undermine trust.'],
		],
	},
	{
		slug: 'customer-service',
		name: 'Chăm sóc khách hàng',
		description: 'Xử lý yêu cầu và khiếu nại.',
		tags: ['TOEIC', 'Work'],
		cards: [
			['complaint', 'lời phàn nàn', 'n', 'We received a complaint.'],
			['inquiry', 'yêu cầu thông tin', 'n', 'Thank you for your inquiry.'],
			['resolve', 'giải quyết', 'v', 'We will resolve the issue today.'],
			['apologize', 'xin lỗi', 'v', 'We apologize for the inconvenience.'],
			['warranty', 'bảo hành', 'n', 'It has a two-year warranty.'],
		],
	},
	{
		slug: 'phrasal-office',
		name: 'Phrasal verb công sở',
		description: 'Cụm động từ trong email và cuộc họp.',
		tags: ['Work', 'Vocabulary'],
		cards: [
			['bring up', 'nêu ra', 'v', 'She brought up a good point.'],
			['go over', 'xem lại', 'v', "Let's go over the plan."],
			['put off', 'hoãn lại', 'v', 'They put off the meeting.'],
			['follow up', 'theo dõi tiếp', 'v', "I'll follow up next week."],
			['get back to', 'phản hồi lại', 'v', "I'll get back to you soon."],
		],
	},
];

export const PUBLIC_FLASHCARD_LISTS: SeedFlashCardList[] = LISTS.map((l, i) => ({
	id: `seed-fcl-pub-${l.slug}`,
	authorId: AUTHORS[(i + 3) % AUTHORS.length],
	name: l.name,
	description: l.description,
	isPublic: true,
	tags: l.tags,
	daysAgo: 2 + i,
	cards: l.cards.map(([word, definition, partOfSpeech, example], j) => ({
		id: `seed-fc-pub-${l.slug}-${j + 1}`,
		word: word,
		definition: definition,
		partOfSpeech: partOfSpeech,
		examples: [example],
	})),
}));
