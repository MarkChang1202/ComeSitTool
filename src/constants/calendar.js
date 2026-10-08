// Google 日曆設定（公開日曆，透過 iCal feed 同步，不需要 API key）
export const CALENDAR_ID =
  "027fa21106e4e17619367e199fe7d47428745e94930261af8c07894edcf3087e@group.calendar.google.com";

export const CALENDAR_TIMEZONE = "Asia/Taipei";

// 經由 Vercel rewrite / devServer proxy 轉發到 calendar.google.com，避開 CORS
export const CALENDAR_ICS_URL = `/gcal-api/calendar/ical/${encodeURIComponent(
  CALENDAR_ID
)}/public/basic.ics`;

export const CALENDAR_WEB_URL = `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(
  CALENDAR_ID
)}&ctz=${encodeURIComponent(CALENDAR_TIMEZONE)}`;

export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export const EVENT_COLORS = [
  "#1d80ff",
  "#42b983",
  "#ff8a3d",
  "#a66cff",
  "#ff5c7a",
  "#14b8c4",
];
