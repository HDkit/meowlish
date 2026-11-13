import { SEED_USERS, photo } from './users';

export interface SeedBlog {
	/** Used when the post does not exist yet; existing posts (matched by title) keep their id. */
	id: string;
	title: string;
	/** Earlier titles of the same post, so re-seeding updates instead of duplicating. */
	formerTitles?: string[];
	authorId: string;
	tags: string[];
	/** Markdown. A leading image is the cover the blog pages show. */
	content: string;
}

const PHOTOS = {
	deskRoutine: '1488190211105-8b0e65b80b4e',
	writingHand: '1434030216411-0b793f4b4173',
	podcastMic: '1478737270239-2f02b77fc618',
	bookStack: '1497633762265-9d179a990aa6',
	laptopNotes: '1501504905252-473c47e087f8',
	appleBooks: '1503676260728-1c00da094a0b',
	notesPen: '1517842645767-c639042777db',
	handshake: '1521791136064-7986c2920216',
	studyGroup: '1522202176988-66273c2fd55f',
	meeting: '1551836022-d5d88e9218df',
	openBooks: '1456513080510-7bf3a84b82f8',
	pointingLaptop: '1516321318423-f06f85e504b3',
};

export const SEED_BLOGS: SeedBlog[] = [
	{
		id: 'seed-blog-daily-routine',
		title: 'Cách học tiếng Anh hiệu quả mỗi ngày',
		authorId: SEED_USERS.linh,
		tags: ['tieng-anh', 'hoc-tap', 'phuong-phap'],
		content: `![Góc học tập buổi sáng với laptop, sổ tay và cà phê](${photo(PHOTOS.deskRoutine)})

Học tiếng Anh không cần những buổi "cày" 4 tiếng vào cuối tuần. Thứ tạo ra khác biệt là **30–45 phút đều đặn mỗi ngày**, được chia thành những phần nhỏ đủ dễ để bạn không bỏ cuộc.

## 1. Chia nhỏ thời gian theo kỹ năng

Một buổi học hiệu quả nên chạm vào cả bốn kỹ năng, nhưng không cần dàn đều. Đây là lịch mẫu mà nhiều học viên của Lingriser đang dùng:

| Thời lượng | Hoạt động | Mục tiêu |
| --- | --- | --- |
| 10 phút | Ôn flashcard từ vựng | Nhớ lâu bằng lặp lại ngắt quãng |
| 10 phút | Nghe một đoạn podcast ngắn | Làm quen tốc độ nói tự nhiên |
| 10 phút | Đọc một bài báo, gạch chân cụm từ hay | Mở rộng vốn diễn đạt |
| 5–15 phút | Nói hoặc viết lại nội dung vừa học | Biến kiến thức thụ động thành chủ động |

## 2. Học theo cụm, không học từ đơn lẻ

Thay vì ghi *decision = quyết định*, hãy ghi cả cụm:

- **make** a decision (đưa ra quyết định), không phải ~~do a decision~~
- a **tough** decision (một quyết định khó khăn)
- **reach** a decision after a long discussion

> Từ vựng sống trong ngữ cảnh. Một cụm từ đúng giúp bạn nói tự nhiên hơn mười từ đơn lẻ.

## 3. Ghi lại tiến độ

Cuối mỗi tuần, tự hỏi ba câu:

1. Tuần này mình học được **bao nhiêu cụm từ mới** và dùng lại được bao nhiêu?
2. Kỹ năng nào mình đang né tránh?
3. Tuần sau mình sẽ thay đổi **một** điều gì?

Trang *Tiến độ* trong ứng dụng ghi lại chuỗi ngày học và điểm các bài thi thử — hãy mở nó mỗi Chủ nhật.

## 4. Chấp nhận sai

Người học giỏi không phải người không mắc lỗi, mà là người **mắc lỗi sớm và sửa nhanh**. Hãy nói, viết, rồi nhờ bạn bè hoặc AI chấm giúp. Mỗi lỗi được sửa là một lần não bạn ghi nhớ sâu hơn.

---

*Bắt đầu nhỏ thôi: hôm nay chỉ cần 15 phút. Ngày mai thêm 5 phút nữa.*
`,
	},
	{
		id: 'seed-blog-pronunciation',
		title: '5 lỗi thường gặp khi phát âm tiếng Anh',
		authorId: SEED_USERS.duc,
		tags: ['phat-am', 'tieng-anh', 'luyen-tap'],
		content: `![Nhóm bạn trò chuyện và luyện nói tiếng Anh](${photo(PHOTOS.studyGroup)})

Người Việt thường nói tiếng Anh *khá dễ nghe*, nhưng vẫn có vài lỗi lặp đi lặp lại khiến người bản xứ phải hỏi lại. Dưới đây là 5 lỗi phổ biến nhất và cách sửa từng lỗi.

## Lỗi 1: Bỏ âm cuối

Tiếng Việt không bật âm cuối như tiếng Anh, nên ta hay nói *"I like it"* thành *"I lai i"*.

- **Cách sửa:** đọc chậm, phóng đại âm cuối: like**k**, wan**t**, ask**ed** /æskt/.
- Luyện các cặp tối thiểu: *rice – rise*, *bag – back*, *cap – cab*.

## Lỗi 2: Âm /θ/ và /ð/

| Âm | Ví dụ | Hay bị đọc thành | Cách đặt lưỡi |
| --- | --- | --- | --- |
| /θ/ | **th**ink, ba**th** | /t/ hoặc /s/ | Đầu lưỡi giữa hai hàm răng, thổi hơi |
| /ð/ | **th**is, mo**th**er | /d/ hoặc /z/ | Giống /θ/ nhưng rung dây thanh |

## Lỗi 3: Âm /ʃ/ và /s/

*She sells sea shells* là câu luyện kinh điển. Với /ʃ/, môi hơi tròn và đẩy ra trước; với /s/, môi dẹt và hơi đi qua kẽ răng.

## Lỗi 4: Trọng âm sai

Trọng âm sai có thể đổi cả nghĩa của từ:

- **RE**cord (danh từ: bản ghi) và re**CORD** (động từ: ghi lại)
- **PRE**sent (món quà) và pre**SENT** (trình bày)

> Mẹo: tra từ điển và để ý dấu ˈ đứng trước âm tiết được nhấn, ví dụ /rɪˈkɔːd/.

## Lỗi 5: Nói đều đều, không có ngữ điệu

Tiếng Anh là ngôn ngữ có nhịp: các từ quan trọng được nhấn, các từ chức năng (*a, the, to, of*) được nói lướt. Hãy nghe một câu, rồi **shadowing**: nói đè lên giọng người bản xứ, bắt chước cả lên xuống giọng.

## Bài tập 5 phút mỗi ngày

1. Chọn 3 câu trong bài nghe hôm nay.
2. Ghi âm giọng mình đọc ba câu đó.
3. So với bản gốc, đánh dấu chỗ khác nhau.
4. Đọc lại và ghi âm lần hai.

Sau hai tuần, nghe lại bản ghi đầu tiên — bạn sẽ bất ngờ đấy.
`,
	},
	{
		id: 'seed-blog-office-vocab',
		title: 'Từ vựng tiếng Anh chủ đề công sở',
		authorId: SEED_USERS.hoa,
		tags: ['tu-vung', 'cong-so', 'tieng-anh'],
		content: `![Hai đồng nghiệp trao đổi công việc bên laptop](${photo(PHOTOS.meeting)})

Dù bạn làm ở công ty nước ngoài hay chỉ thỉnh thoảng gửi email cho đối tác, những từ vựng dưới đây xuất hiện **mỗi ngày**. Chúng cũng là nhóm từ ra nhiều nhất trong TOEIC Part 3, 4 và 7.

## Cuộc họp (Meetings)

| Từ / cụm từ | Nghĩa | Ví dụ |
| --- | --- | --- |
| agenda | chương trình họp | Let's stick to the **agenda**. |
| minutes | biên bản họp | Lan will take the **minutes**. |
| follow up (on) | theo dõi, làm tiếp | I'll **follow up on** this by Friday. |
| postpone | hoãn | The meeting has been **postponed** to Monday. |
| action item | đầu việc cần làm | Each **action item** needs an owner. |

## Tiến độ và hạn chót

- **deadline**: hạn chót, *meet / miss a deadline*
- **on track**: đúng tiến độ, *We're on track to launch in May.*
- **behind schedule**: chậm tiến độ
- **prioritise**: ưu tiên, *Please prioritise the client report.*

![Cái bắt tay sau khi chốt hợp đồng](${photo(PHOTOS.handshake, 900)})

## Làm việc với khách hàng và đối tác

1. **proposal**: bản đề xuất
2. **quote / quotation**: báo giá
3. **negotiate**: đàm phán, *negotiate the terms*
4. **sign off on**: phê duyệt, *The manager signed off on the budget.*

> Ghi nhớ theo **tình huống**, không theo bảng chữ cái: mỗi khi đi họp, hãy thử dùng lại một cụm từ trong danh sách.

## Luyện ngay

Điền từ thích hợp: *We are slightly ______ schedule, so I suggest we ______ the launch by one week.*

<details>
<summary>Xem đáp án</summary>

behind, postpone

</details>
`,
	},
	{
		id: 'seed-blog-professional-email',
		title: 'Làm thế nào để viết email chuyên nghiệp bằng tiếng Anh',
		authorId: SEED_USERS.minh,
		tags: ['email', 'viet-lach', 'tieng-anh'],
		content: `![Bàn tay đang viết bản nháp email vào sổ](${photo(PHOTOS.writingHand)})

Một email tốt giúp người đọc hiểu **bạn cần gì** trong 10 giây đầu. Bài này đưa ra cấu trúc 5 phần và một mẫu bạn có thể dùng ngay.

## Cấu trúc 5 phần

1. **Subject line** — ngắn, cụ thể: *Request: Q3 sales report by 15 May*
2. **Greeting** — *Dear Ms Nguyen,* (trang trọng) hoặc *Hi Lan,* (đồng nghiệp)
3. **Purpose** — câu đầu tiên nói rõ mục đích
4. **Details** — gạch đầu dòng nếu có nhiều ý
5. **Closing** — lời đề nghị hành động + chữ ký

## Mẫu email xin tài liệu

\`\`\`text
Subject: Request for the Q3 sales report

Dear Mr Tran,

I am writing to request the Q3 sales report for the northern region.
We would like to review it before the planning meeting on 15 May.

Could you please send it by Friday, 10 May? If any figures are
still being finalised, a draft would be very helpful.

Thank you in advance.

Best regards,
Hoang Minh
Marketing Executive
\`\`\`

## Trang trọng hay thân mật?

| Tình huống | Trang trọng | Thân mật hơn |
| --- | --- | --- |
| Mở đầu | I am writing to… | Just a quick note about… |
| Nhờ vả | Could you please…? | Can you…? |
| Xin lỗi | I apologise for the delay. | Sorry for the late reply! |
| Kết thúc | I look forward to hearing from you. | Talk soon! |

> Khi không chắc, hãy chọn cách **trang trọng hơn một bậc**. Không ai phật lòng vì bạn quá lịch sự.

## Checklist trước khi bấm Gửi

- [x] Tiêu đề nói rõ nội dung
- [x] Tên người nhận viết đúng
- [x] Có hạn chót / hành động cụ thể
- [ ] Đã kiểm tra tệp đính kèm (lỗi kinh điển!)
- [ ] Đã đọc lại một lượt thành tiếng
`,
	},
	{
		id: 'seed-blog-podcast-listening',
		title: 'Bí quyết luyện nghe tiếng Anh qua podcast',
		authorId: SEED_USERS.tuan,
		tags: ['nghe', 'podcast', 'tieng-anh'],
		content: `![Micro thu âm podcast trong phòng tối](${photo(PHOTOS.podcastMic)})

Podcast là "giáo viên" kiên nhẫn nhất: nói bao nhiêu lần cũng được, theo bạn lên xe buýt, vào bếp, ra phòng gym. Nhưng nghe thụ động thì tiến bộ rất chậm. Đây là quy trình **4 bước** để mỗi tập podcast thật sự có ích.

## Chọn podcast vừa sức

| Trình độ | Gợi ý | Vì sao |
| --- | --- | --- |
| A2–B1 | *6 Minute English* (BBC) | Ngắn, có transcript, giải thích từ vựng |
| B1–B2 | *All Ears English* | Hội thoại tự nhiên, nhiều cụm từ giao tiếp |
| B2–C1 | *TED Talks Daily* | Chủ đề đa dạng, sát IELTS Speaking Part 3 |
| C1+ | *The Economist Podcasts* | Tốc độ nhanh, từ vựng học thuật |

Quy tắc chọn: bạn nên hiểu **khoảng 70%** khi nghe lần đầu. Ít hơn thì nản, nhiều hơn thì không học thêm được gì.

## Quy trình 4 bước

1. **Nghe lướt** cả tập, không dừng. Chỉ cần nắm ý chính.
2. **Nghe kỹ** từng đoạn 1–2 phút, ghi lại từ khoá nghe được.
3. **Đối chiếu transcript**: gạch chân những chỗ nghe sai, tìm lý do (nối âm? từ mới? nói nhanh?).
4. **Shadowing** 2–3 câu hay nhất: nói theo, bắt chước ngữ điệu.

> Bước 3 là nơi bạn học nhiều nhất. Đừng bỏ qua nó.

## Ghi chép thông minh

Chỉ ghi **cụm từ** bạn muốn dùng lại, kèm câu gốc:

- *to be on the fence* — phân vân: *I'm still on the fence about moving to Da Nang.*
- *a game changer* — thứ thay đổi cuộc chơi

Rồi đưa chúng vào bộ flashcard của bạn để ôn lại vào tuần sau.
`,
	},
	{
		id: 'seed-blog-ielts-writing-task2',
		title: 'Lộ trình IELTS Writing Task 2: từ 5.5 lên 7.0',
		authorId: SEED_USERS.thao,
		tags: ['ielts', 'viet-lach', 'luyen-thi'],
		content: `![Sổ ghi chú, bút máy và kính trên bàn gỗ](${photo(PHOTOS.notesPen)})

Writing Task 2 chiếm **2/3 điểm** kỹ năng Viết, và cũng là phần nhiều bạn "kẹt" ở 5.5–6.0 lâu nhất. Bài viết này tổng hợp lộ trình 8 tuần mà mình đã dùng để lên 7.0.

## Hiểu bốn tiêu chí chấm

| Tiêu chí | Band 6 | Band 7 |
| --- | --- | --- |
| Task Response | Trả lời đủ nhưng ý chưa phát triển | Quan điểm rõ xuyên suốt, ý được mở rộng và có ví dụ |
| Coherence & Cohesion | Có liên kết nhưng máy móc | Dùng từ nối linh hoạt, mỗi đoạn một ý trung tâm |
| Lexical Resource | Đủ từ, còn lỗi chính tả/kết hợp từ | Có từ ít phổ biến, collocation tự nhiên |
| Grammar | Kết hợp câu đơn và phức, lỗi khá nhiều | Nhiều câu phức không lỗi |

## Dàn ý 4 đoạn

1. **Mở bài** (2 câu): paraphrase đề + nêu quan điểm.
2. **Thân bài 1**: ý chính → giải thích → ví dụ cụ thể.
3. **Thân bài 2**: ý chính thứ hai (hoặc phản biện) theo cùng cấu trúc.
4. **Kết bài** (1–2 câu): nhắc lại quan điểm, không thêm ý mới.

> Dành **5 phút lập dàn ý** trước khi viết. Bài có dàn ý gần như luôn được điểm Coherence cao hơn.

## Một đoạn thân bài mẫu

> *Đề: Some people think that universities should only offer subjects that are useful in the job market.*

> Admittedly, prioritising career-oriented courses can ease graduate unemployment. When degree programmes are designed around the skills employers need, such as data analysis or software development, students are far more likely to secure a job shortly after graduation. In Vietnam, for instance, IT graduates are often recruited before they even finish their final year.

## Lộ trình 8 tuần

- **Tuần 1–2:** học cấu trúc, phân tích 10 bài mẫu band 7+
- **Tuần 3–4:** mỗi tuần 3 bài, tập trung Task Response
- **Tuần 5–6:** sửa lỗi ngữ pháp lặp lại, xây "ngân hàng" collocation theo chủ đề
- **Tuần 7–8:** viết bấm giờ 40 phút, nhờ chấm và viết lại

Bạn có thể dùng tính năng chấm bài Writing trong ứng dụng để nhận nhận xét theo từng tiêu chí sau mỗi bài.
`,
	},
	{
		id: 'seed-blog-toeic-part7',
		title: 'Mẹo chinh phục TOEIC Reading Part 7',
		authorId: SEED_USERS.khoa,
		tags: ['toeic', 'doc-hieu', 'luyen-thi'],
		content: `![Laptop và sổ tay mở trên bàn học](${photo(PHOTOS.laptopNotes)})

Part 7 có **54 câu** — hơn một nửa phần Reading — và là nơi đa số thí sinh hết giờ. Muốn đạt 400+ Reading, bạn cần chiến lược quản lý thời gian rõ ràng.

## Phân bổ thời gian

| Phần | Số câu | Thời gian gợi ý |
| --- | --- | --- |
| Part 5 | 30 | 10 phút |
| Part 6 | 16 | 8 phút |
| Part 7 – đoạn đơn | 29 | 25 phút |
| Part 7 – đoạn kép/ba | 25 | 30 phút |
| Kiểm tra lại | — | 2 phút |

## Thứ tự làm bài

1. **Đọc câu hỏi trước**, gạch chân từ khoá (tên riêng, số, ngày tháng).
2. Đọc lướt đoạn văn tìm từ khoá đó — đừng đọc kỹ từng chữ.
3. Với câu hỏi *NOT true*, loại trừ từng đáp án.
4. Câu nào quá 1 phút: đánh dấu, đoán, **đi tiếp**.

## Các dạng câu hỏi hay gặp

- **Main idea:** *What is the purpose of the email?* → thường nằm ở 1–2 câu đầu.
- **Detail:** *When will the event take place?* → quét số và ngày.
- **Inference:** *What is suggested about Mr Lee?* → không có sẵn chữ trong bài, cần suy luận.
- **Vocabulary:** *The word "cover" in paragraph 2 is closest in meaning to…*
- **Sentence insertion:** *In which position does the sentence best belong?*

> Với đoạn kép/ba, câu hỏi cuối gần như luôn yêu cầu **kết hợp thông tin** từ hai văn bản. Đọc cả hai trước khi chọn.

## Luyện tập

Vào mục *Chọn đề thi*, lọc theo **TOEIC** và làm riêng phần Reading. Sau mỗi đề, xem lại những câu sai theo từng dạng để biết mình yếu ở đâu.
`,
	},
	{
		id: 'seed-blog-present-perfect',
		title: 'Thì hiện tại hoàn thành: hiểu một lần, dùng mãi mãi',
		authorId: SEED_USERS.mai,
		tags: ['ngu-phap', 'tieng-anh', 'co-ban'],
		content: `![Táo đỏ đặt trên chồng sách và khối chữ ABC](${photo(PHOTOS.appleBooks)})

Hiện tại hoàn thành (*present perfect*) là thì khiến người Việt bối rối nhất, vì tiếng Việt không có khái niệm tương ứng. Tin vui: chỉ cần nắm **một ý tưởng cốt lõi**.

> Hiện tại hoàn thành nối **quá khứ** với **hiện tại**: việc đã xảy ra, nhưng kết quả hoặc ý nghĩa của nó vẫn còn liên quan đến bây giờ.

## Công thức

\`\`\`text
(+)  S + have/has + V3/ed       I have finished my homework.
(-)  S + have/has + not + V3/ed She hasn't called yet.
(?)  Have/Has + S + V3/ed?      Have you ever been to Hue?
\`\`\`

## Bốn cách dùng chính

1. **Trải nghiệm** (không nói khi nào): *I have visited Japan twice.*
2. **Hành động kéo dài đến hiện tại** (với *for/since*): *She has lived here since 2019.*
3. **Kết quả ở hiện tại**: *I've lost my keys* (= bây giờ vẫn chưa tìm thấy).
4. **Việc vừa mới xảy ra** (với *just/already/yet*): *The train has just left.*

## Hiện tại hoàn thành hay quá khứ đơn?

| | Quá khứ đơn | Hiện tại hoàn thành |
| --- | --- | --- |
| Thời điểm | Xác định, đã kết thúc | Không xác định hoặc chưa kết thúc |
| Dấu hiệu | yesterday, last year, in 2020, ago | ever, never, just, yet, for, since |
| Ví dụ | I **saw** that film **last week**. | I **have seen** that film **twice**. |

## Lỗi hay gặp

- ~~I have seen him yesterday.~~ → I **saw** him yesterday.
- ~~I live here for five years.~~ → I **have lived** here for five years.
- ~~Did you ever eat pho?~~ → **Have** you ever **eaten** pho?

## Tự kiểm tra

Chia động từ: *I ______ (work) here since 2022, but I ______ (meet) the CEO only once, last December.*

<details>
<summary>Đáp án</summary>

have worked, met

</details>
`,
	},
];
