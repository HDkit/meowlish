import { Badge, BadgeType } from '../enums/badge.enum';

/**
 * Badge names and descriptions as users see them (the app is in Vietnamese; the frontend's badge
 * catalogue, `src/lib/badges.ts`, uses the same texts). The badge notification quotes `displayName`.
 */
export const BADGE_INFORMATION: Record<
	Badge,
	{ displayName: string; description: string; type: BadgeType }
> = {
	[Badge.LoginSevenDaysStreak]: {
		displayName: 'Đều đặn',
		description: 'Học 7 ngày liên tiếp',
		type: BadgeType.Login,
	},
	[Badge.LoginTwoWeeksStreak]: {
		displayName: 'Chú ong chăm chỉ',
		description: 'Học 14 ngày liên tiếp',
		type: BadgeType.Login,
	},
	[Badge.LoginOneMonthStreak]: {
		displayName: 'Không ngại khó',
		description: 'Học 30 ngày liên tiếp',
		type: BadgeType.Login,
	},
	[Badge.LoginOneYearStreak]: {
		displayName: 'V.I.P',
		description: 'Học mỗi ngày suốt một năm',
		type: BadgeType.Login,
	},

	[Badge.LoginSevenDays]: {
		displayName: 'Bắt nhịp',
		description: 'Học tổng cộng 7 ngày',
		type: BadgeType.Login,
	},
	[Badge.LoginTwoWeeks]: {
		displayName: 'Nhà khám phá',
		description: 'Học tổng cộng 14 ngày',
		type: BadgeType.Login,
	},
	[Badge.LoginOneMonth]: {
		displayName: 'Học viên tận tụy',
		description: 'Học tổng cộng 30 ngày',
		type: BadgeType.Login,
	},
	[Badge.LoginOneYear]: {
		displayName: 'Tròn một năm',
		description: 'Học tổng cộng 365 ngày',
		type: BadgeType.Login,
	},

	[Badge.FirstCompleteAttempt]: {
		displayName: 'Bước đầu tiên',
		description: 'Hoàn thành bài thi đầu tiên',
		type: BadgeType.AttemptCount,
	},
	[Badge.TenthCompleteAttempt]: {
		displayName: 'Khởi động',
		description: 'Hoàn thành 10 bài thi',
		type: BadgeType.AttemptCount,
	},
	[Badge.HundredthCompleteAttempt]: {
		displayName: 'Bách chiến',
		description: 'Hoàn thành 100 bài thi',
		type: BadgeType.AttemptCount,
	},

	[Badge.FirstGoodScore]: {
		displayName: 'Khá lắm!',
		description: 'Đạt điểm tốt lần đầu',
		type: BadgeType.AttemptScore,
	},
	[Badge.TenthGoodScore]: {
		displayName: 'Ngày càng giỏi',
		description: 'Đạt điểm tốt 10 lần',
		type: BadgeType.AttemptScore,
	},
	[Badge.HundredthGoodScore]: {
		displayName: 'Thói quen xuất sắc',
		description: 'Đạt điểm tốt 100 lần',
		type: BadgeType.AttemptScore,
	},

	[Badge.FirstPerfectScore]: {
		displayName: 'Hoàn hảo',
		description: 'Đạt điểm tuyệt đối lần đầu',
		type: BadgeType.AttemptScore,
	},
	[Badge.TenthPerfectScore]: {
		displayName: 'Chính xác tuyệt đối',
		description: 'Đạt điểm tuyệt đối 10 lần',
		type: BadgeType.AttemptScore,
	},
	[Badge.HundredthPerfectScore]: {
		displayName: 'Người cầu toàn',
		description: 'Đạt điểm tuyệt đối 100 lần',
		type: BadgeType.AttemptScore,
	},
};
