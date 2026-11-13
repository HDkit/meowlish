import { SEED_USERS } from './users';

export interface SeedForumCategory {
	id: string;
	name: string;
	description: string;
	position: number;
	moderatorsOnly?: boolean;
}

export interface SeedForumReply {
	id: string;
	authorId: string;
	body: string;
	/** Minutes after the thread was opened. */
	after: number;
	quotes?: string;
}

export interface SeedForumThread {
	id: string;
	categoryId: string;
	authorId: string;
	title: string;
	body: string;
	/** Days before the seed runs. */
	daysAgo: number;
	isPinned?: boolean;
	isLocked?: boolean;
	viewCount: number;
	replies: SeedForumReply[];
}

export const SEED_FORUM_CATEGORIES: SeedForumCategory[] = [
	{
		id: 'thong-bao',
		name: 'Thông báo',
		description: 'Tin tức, cập nhật tính năng và nội quy diễn đàn từ đội ngũ Lingriser.',
		position: 0,
		moderatorsOnly: true,
	},
	{
		id: 'ielts',
		name: 'IELTS',
		description: 'Kinh nghiệm luyện thi, chữa bài Writing/Speaking và chia sẻ tài liệu IELTS.',
		position: 1,
	},
	{
		id: 'toeic',
		name: 'TOEIC',
		description: 'Mẹo làm bài Listening & Reading, lộ trình 450 – 900+ và đề luyện tập.',
		position: 2,
	},
	{
		id: 'ngu-phap-tu-vung',
		name: 'Ngữ pháp & Từ vựng',
		description: 'Hỏi đáp về thì, cấu trúc câu, collocation, phrasal verb và cách ghi nhớ từ.',
		position: 3,
	},
	{
		id: 'hoi-dap',
		name: 'Hỏi đáp',
		description: 'Thắc mắc về cách học, cách dùng ứng dụng, hay bất cứ điều gì bạn chưa rõ.',
		position: 4,
	},
	{
		id: 'goc-chia-se',
		name: 'Góc chia sẻ',
		description: 'Câu chuyện học tập, thành tích, nguồn tài liệu hay và động lực mỗi ngày.',
		position: 5,
	},
	{
		id: 'off-topic',
		name: 'Off-topic',
		description: 'Phim, nhạc, du lịch, đời sống... (vẫn khuyến khích dùng tiếng Anh nhé!).',
		position: 6,
	},
];

export const SEED_FORUM_THREADS: SeedForumThread[] = [
	{
		id: 'seed-thread-noi-quy',
		categoryId: 'thong-bao',
		authorId: SEED_USERS.admin,
		title: 'Nội quy diễn đàn Lingriser — vui lòng đọc trước khi đăng bài',
		daysAgo: 30,
		isPinned: true,
		isLocked: true,
		viewCount: 412,
		body: `Chào mừng bạn đến với diễn đàn Lingriser! Để nơi này luôn hữu ích và thân thiện, mọi thành viên vui lòng tuân thủ các quy định sau:

## Quy định chung

1. **Tôn trọng** mọi người. Không công kích cá nhân, phân biệt đối xử hay dùng ngôn từ thô tục.
2. Đăng bài **đúng chuyên mục**. Bài sai chuyên mục có thể bị di chuyển hoặc xoá.
3. Đặt **tiêu đề rõ ràng**: *"Hỏi về cách dùng since và for"* thay vì *"Giúp với!!!"*.
4. Không spam, quảng cáo hay chia sẻ tài liệu vi phạm bản quyền.

## Khi đặt câu hỏi

- Nêu rõ trình độ hiện tại và mục tiêu của bạn.
- Đính kèm câu/đoạn văn cụ thể nếu hỏi về ngữ pháp.
- Khi đã được giải đáp, hãy phản hồi để người sau cùng tham khảo.

## Báo cáo vi phạm

Thấy bài viết hoặc trả lời không phù hợp? Bấm nút **Báo cáo** (biểu tượng lá cờ) — đội ngũ điều hành sẽ xem xét trong vòng 24 giờ.

Chúc mọi người học tốt! 🌱`,
		replies: [],
	},
	{
		id: 'seed-thread-ra-mat-dien-dan',
		categoryId: 'thong-bao',
		authorId: SEED_USERS.admin,
		title: 'Ra mắt Diễn đàn và tính năng bình luận Blog',
		daysAgo: 2,
		isPinned: true,
		viewCount: 158,
		body: `Xin chào cả nhà,

Hôm nay Lingriser chính thức mở **Diễn đàn** — nơi các bạn có thể hỏi đáp, chia sẻ kinh nghiệm và kết nối với những người cùng mục tiêu.

**Có gì mới?**

- 7 chuyên mục: IELTS, TOEIC, Ngữ pháp & Từ vựng, Hỏi đáp, Góc chia sẻ, Off-topic và Thông báo.
- Soạn bài bằng **Markdown**: in đậm, danh sách, bảng, trích dẫn...
- **Trích dẫn** trả lời của người khác khi phản hồi.
- **Bình luận lồng nhau** dưới mỗi bài Blog.

Hãy góp ý cho tụi mình ngay trong chủ đề này nhé!`,
		replies: [
			{
				id: 'seed-reply-ra-mat-1',
				authorId: SEED_USERS.linh,
				after: 45,
				body: 'Tuyệt quá! Mong chờ tính năng này lâu rồi. Có thể thêm thông báo khi có người trả lời chủ đề của mình không ạ?',
			},
			{
				id: 'seed-reply-ra-mat-2',
				authorId: SEED_USERS.admin,
				after: 120,
				quotes: 'seed-reply-ra-mat-1',
				body: 'Cảm ơn bạn! Thông báo trả lời đã có trong kế hoạch, tụi mình sẽ cập nhật sớm.',
			},
		],
	},
	{
		id: 'seed-thread-ielts-task2-dan-y',
		categoryId: 'ielts',
		authorId: SEED_USERS.nam,
		title: 'Mất quá nhiều thời gian lập dàn ý Writing Task 2, phải làm sao?',
		daysAgo: 6,
		viewCount: 97,
		body: `Mình đang ở band 6.0 Writing. Vấn đề lớn nhất là mình mất **10–12 phút** chỉ để nghĩ ý cho Task 2, nên phần viết luôn bị gấp và kết bài rất vội.

Mọi người có cách nào để lập dàn ý nhanh hơn không? Có nên học thuộc ý tưởng theo chủ đề không?`,
		replies: [
			{
				id: 'seed-reply-task2-1',
				authorId: SEED_USERS.thao,
				after: 50,
				body: `Mình từng bị y hệt. Cách mình làm:

1. Đọc đề, xác định **dạng bài** (opinion, discussion, problem–solution...).
2. Với mỗi dạng, mình có sẵn **khung 4 đoạn** trong đầu nên chỉ cần điền ý.
3. Mỗi thân bài chỉ cần **1 ý chính + 1 ví dụ**, đừng cố nhồi 3 ý.

Luyện như vậy khoảng 2 tuần là mình xuống còn 5 phút.`,
			},
			{
				id: 'seed-reply-task2-2',
				authorId: SEED_USERS.minh,
				after: 180,
				body: 'Học thuộc ý tưởng thì không nên, nhưng nên có **"ngân hàng ví dụ"** theo chủ đề (giáo dục, môi trường, công nghệ...). Ví dụ cụ thể dùng được cho nhiều đề khác nhau.',
			},
			{
				id: 'seed-reply-task2-3',
				authorId: SEED_USERS.nam,
				after: 300,
				quotes: 'seed-reply-task2-1',
				body: 'Cảm ơn chị, mình sẽ thử khung 4 đoạn. Chỉ 1 ý chính mỗi đoạn có bị trừ điểm Task Response không ạ?',
			},
			{
				id: 'seed-reply-task2-4',
				authorId: SEED_USERS.thao,
				after: 340,
				quotes: 'seed-reply-task2-3',
				body: 'Không đâu em. Band 7 yêu cầu ý được **phát triển đầy đủ**, không phải nhiều ý. Một ý giải thích kỹ có ví dụ tốt hơn ba ý hời hợt.',
			},
		],
	},
	{
		id: 'seed-thread-ielts-speaking-part2',
		categoryId: 'ielts',
		authorId: SEED_USERS.mai,
		title: '[Chia sẻ] Bộ câu hỏi Speaking Part 2 quý này và cách mình chuẩn bị',
		daysAgo: 12,
		viewCount: 143,
		body: `Mình tổng hợp một số đề Part 2 hay gặp gần đây:

| Chủ đề | Gợi ý câu chuyện |
| --- | --- |
| Describe a time you helped someone | Giúp bạn ôn thi, chỉ đường cho khách du lịch |
| Describe a useful app | Ứng dụng học từ vựng, bản đồ |
| Describe a place you want to visit | Đà Lạt, Nhật Bản |
| Describe a skill you learned recently | Nấu ăn, chơi guitar |

Mẹo của mình: chuẩn bị **4–5 câu chuyện "đa năng"** rồi biến tấu cho từng đề. Ví dụ câu chuyện về chuyến đi Đà Lạt dùng được cho *a trip*, *a place*, *a time you felt relaxed*...`,
		replies: [
			{
				id: 'seed-reply-speaking-1',
				authorId: SEED_USERS.duc,
				after: 90,
				body: 'Mẹo câu chuyện đa năng hay quá. Mình hay bị bí ý ở phút thứ 2, chắc do chưa chuẩn bị chi tiết.',
			},
			{
				id: 'seed-reply-speaking-2',
				authorId: SEED_USERS.mai,
				after: 200,
				quotes: 'seed-reply-speaking-1',
				body: 'Bạn thử dùng khung **Who – What – When – Where – Why – How I felt** nhé. Hết ý thì kể cảm xúc và bài học rút ra, giám khảo rất thích phần này.',
			},
		],
	},
	{
		id: 'seed-thread-toeic-part3',
		categoryId: 'toeic',
		authorId: SEED_USERS.hoa,
		title: 'TOEIC Listening Part 3: nghe không kịp đọc câu hỏi',
		daysAgo: 4,
		viewCount: 76,
		body: `Mình luyện Part 3 được khoảng 60% câu đúng. Vấn đề là đoạn hội thoại bắt đầu khi mình **chưa đọc xong 3 câu hỏi**, thế là rối luôn.

Có ai có mẹo đọc trước câu hỏi hiệu quả không?`,
		replies: [
			{
				id: 'seed-reply-part3-1',
				authorId: SEED_USERS.khoa,
				after: 30,
				body: `Mẹo kinh điển: **tranh thủ lúc đọc hướng dẫn và lúc đọc đáp án** của câu trước.

- Chỉ đọc **câu hỏi**, không đọc các lựa chọn A–D.
- Gạch chân từ để hỏi: *What, Who, Why, When*.
- Câu hỏi thường theo thứ tự nội dung hội thoại.

Mình từ 60% lên 80% sau 3 tuần áp dụng.`,
			},
			{
				id: 'seed-reply-part3-2',
				authorId: SEED_USERS.hoa,
				after: 400,
				quotes: 'seed-reply-part3-1',
				body: 'Hôm nay làm thử đúng 11/13 câu 😭 cảm ơn anh nhiều!',
			},
		],
	},
	{
		id: 'seed-thread-toeic-lo-trinh-650',
		categoryId: 'toeic',
		authorId: SEED_USERS.tuan,
		title: 'Lộ trình 3 tháng từ 450 lên 650 TOEIC cho người đi làm',
		daysAgo: 20,
		viewCount: 210,
		body: `Mình đi làm full-time, mỗi ngày chỉ có khoảng **1 tiếng**. Đây là lộ trình mình đã dùng:

- **Tháng 1:** ngữ pháp nền (thì, từ loại, câu bị động) + 600 từ vựng TOEIC cơ bản.
- **Tháng 2:** luyện từng Part, mỗi ngày một Part, chữa kỹ câu sai.
- **Tháng 3:** mỗi tuần 2 đề full test bấm giờ.

Kết quả: 455 → 670 sau 12 tuần. Ai cần bộ flashcard mình dùng thì để lại bình luận nhé!`,
		replies: [
			{
				id: 'seed-reply-650-1',
				authorId: SEED_USERS.nam,
				after: 60,
				body: 'Chúc mừng bạn! Cho mình xin bộ flashcard với ạ.',
			},
			{
				id: 'seed-reply-650-2',
				authorId: SEED_USERS.tuan,
				after: 150,
				quotes: 'seed-reply-650-1',
				body: 'Mình đã để chế độ công khai bộ *"TOEIC 600 từ cơ bản"* trong mục Flashcards, bạn tìm theo tên nhé.',
			},
		],
	},
	{
		id: 'seed-thread-since-for',
		categoryId: 'ngu-phap-tu-vung',
		authorId: SEED_USERS.linh,
		title: 'Phân biệt "since" và "for" trong thì hiện tại hoàn thành',
		daysAgo: 3,
		viewCount: 64,
		body: `Câu nào đúng ạ?

1. I have studied English **since** five years.
2. I have studied English **for** five years.

Mình hay bị nhầm hai từ này.`,
		replies: [
			{
				id: 'seed-reply-since-1',
				authorId: SEED_USERS.mai,
				after: 20,
				body: `Câu **2** đúng nhé.

- **for** + *khoảng thời gian*: for five years, for two weeks, for a long time
- **since** + *mốc thời gian*: since 2020, since Monday, since I was a child

Mẹo nhớ: *since* đi với **điểm bắt đầu**, *for* đi với **độ dài**.`,
			},
			{
				id: 'seed-reply-since-2',
				authorId: SEED_USERS.linh,
				after: 75,
				quotes: 'seed-reply-since-1',
				body: 'Rõ ràng quá, cảm ơn bạn!',
			},
		],
	},
	{
		id: 'seed-thread-phrasal-verbs',
		categoryId: 'ngu-phap-tu-vung',
		authorId: SEED_USERS.khoa,
		title: 'Học phrasal verb thế nào cho đỡ "loạn"?',
		daysAgo: 9,
		viewCount: 88,
		body: 'Phrasal verb nhiều quá: *give up, give in, give out, give away*... học xong lại quên. Mọi người có phương pháp gì không?',
		replies: [
			{
				id: 'seed-reply-phrasal-1',
				authorId: SEED_USERS.duc,
				after: 40,
				body: `Học theo **giới từ** thay vì theo động từ sẽ dễ hơn, vì giới từ mang nghĩa khá ổn định:

| Tiểu từ | Ý nghĩa thường gặp | Ví dụ |
| --- | --- | --- |
| up | hoàn thành, tăng lên | use up, speed up |
| out | ra ngoài, hết | run out, find out |
| off | rời đi, dừng | take off, turn off |`,
			},
		],
	},
	{
		id: 'seed-thread-hoc-tu-vung-app',
		categoryId: 'hoi-dap',
		authorId: SEED_USERS.duc,
		title: 'Ôn flashcard mỗi ngày bao nhiêu từ là hợp lý?',
		daysAgo: 1,
		viewCount: 31,
		body: 'Mình mới dùng tính năng Flashcards. Mỗi ngày nên học bao nhiêu từ mới và ôn lại bao nhiêu từ cũ thì hiệu quả ạ?',
		replies: [
			{
				id: 'seed-reply-flashcard-1',
				authorId: SEED_USERS.hoa,
				after: 90,
				body: 'Mình học **10–15 từ mới** mỗi ngày và ôn hết các từ đến hạn. Quan trọng là đều đặn, đừng học 100 từ một hôm rồi nghỉ cả tuần.',
			},
			{
				id: 'seed-reply-flashcard-2',
				authorId: SEED_USERS.demo,
				after: 160,
				body: 'Mình chia từ theo chủ đề thành từng bộ nhỏ (IELTS học thuật, TOEIC văn phòng, collocation), mỗi bộ 5–6 thẻ, nên ôn nhanh và dễ nhớ hơn hẳn.',
			},
		],
	},
	{
		id: 'seed-thread-dong-luc',
		categoryId: 'goc-chia-se',
		authorId: SEED_USERS.thao,
		title: 'Mình đã đạt IELTS 7.5 sau 2 lần thi — chia sẻ hành trình',
		daysAgo: 15,
		viewCount: 305,
		body: `Lần đầu mình được **6.0** (Writing 5.5). Sau 5 tháng, lần hai mình đạt **7.5** (L 8.0 – R 8.0 – W 6.5 – S 7.0).

> Thay đổi lớn nhất không phải là học nhiều hơn, mà là học **có phản hồi**: mỗi bài viết đều được chấm và mình viết lại.

Những thứ giúp mình nhiều nhất:

- Nghe podcast mỗi sáng trên đường đi làm
- Viết 3 bài Task 2 mỗi tuần và sửa kỹ
- Nói chuyện với bạn trong phòng chat tiếng Anh của app

Ai đang ôn thì cố lên nhé, chắc chắn sẽ được!`,
		replies: [
			{
				id: 'seed-reply-dongluc-1',
				authorId: SEED_USERS.linh,
				after: 30,
				body: 'Chúc mừng chị! Đọc xong có thêm động lực hẳn 💪',
			},
			{
				id: 'seed-reply-dongluc-2',
				authorId: SEED_USERS.nam,
				after: 240,
				body: 'Chị có dùng sách nào cho Writing không ạ?',
			},
			{
				id: 'seed-reply-dongluc-3',
				authorId: SEED_USERS.thao,
				after: 360,
				quotes: 'seed-reply-dongluc-2',
				body: 'Chị chủ yếu phân tích bài mẫu band 8 và học collocation theo chủ đề, sách thì chỉ dùng bộ Cambridge để luyện đề thôi em.',
			},
		],
	},
	{
		id: 'seed-thread-phim-hay',
		categoryId: 'off-topic',
		authorId: SEED_USERS.tuan,
		title: 'Recommend some TV series for learning English?',
		daysAgo: 7,
		viewCount: 120,
		body: `Let's practise English here! What series do you watch with English subtitles?

My list:

- *Friends* — easy, everyday conversations
- *Brooklyn Nine-Nine* — funny, lots of idioms
- *The Crown* — British accent, more formal vocabulary`,
		replies: [
			{
				id: 'seed-reply-phim-1',
				authorId: SEED_USERS.mai,
				after: 100,
				body: "I'd add *Modern Family*! The episodes are short and the jokes are great for learning natural expressions.",
			},
			{
				id: 'seed-reply-phim-2',
				authorId: SEED_USERS.khoa,
				after: 220,
				body: '*Ted Lasso* is my favourite. Very motivating, and you can hear both British and American accents.',
			},
		],
	},
];

export interface SeedBlogComment {
	id: string;
	authorId: string;
	content: string;
	replies?: SeedBlogComment[];
}

/** Comment trees keyed by seed blog id. */
export const SEED_BLOG_COMMENTS: Record<string, SeedBlogComment[]> = {
	'seed-blog-daily-routine': [
		{
			id: 'seed-comment-routine-1',
			authorId: SEED_USERS.nam,
			content: 'Lịch 30 phút này rất thực tế cho người đi làm như mình. Cảm ơn tác giả!',
			replies: [
				{
					id: 'seed-comment-routine-1a',
					authorId: SEED_USERS.linh,
					content: 'Cảm ơn bạn! Bạn thử áp dụng 2 tuần rồi quay lại chia sẻ kết quả nhé.',
					replies: [
						{
							id: 'seed-comment-routine-1a1',
							authorId: SEED_USERS.nam,
							content: 'Chắc chắn rồi, mình bắt đầu từ hôm nay 😄',
						},
					],
				},
			],
		},
		{
			id: 'seed-comment-routine-2',
			authorId: SEED_USERS.hoa,
			content: 'Phần học theo cụm từ rất hay. Mình hay học từ đơn nên nói rất cứng.',
		},
	],
	'seed-blog-pronunciation': [
		{
			id: 'seed-comment-pron-1',
			authorId: SEED_USERS.khoa,
			content: 'Âm /θ/ đúng là ác mộng của mình. Có video nào hướng dẫn đặt lưỡi không ạ?',
			replies: [
				{
					id: 'seed-comment-pron-1a',
					authorId: SEED_USERS.duc,
					content:
						'Bạn tìm "BBC Learning English pronunciation th" trên YouTube nhé, có hình minh hoạ khẩu hình rất rõ.',
				},
			],
		},
	],
	'seed-blog-ielts-writing-task2': [
		{
			id: 'seed-comment-task2-1',
			authorId: SEED_USERS.minh,
			content: 'Bảng so sánh band 6 và 7 giúp mình hiểu vì sao mãi kẹt ở 6.0. Cảm ơn chị!',
		},
		{
			id: 'seed-comment-task2-demo',
			authorId: SEED_USERS.demo,
			content:
				'Bài Task 2 gần nhất của mình được 6.0, nhận xét đúng là ý chưa được phát triển đủ. Mình sẽ thử thêm ví dụ cụ thể cho mỗi đoạn như bài viết gợi ý.',
		},
	],
};
