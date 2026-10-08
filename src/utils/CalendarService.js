import ICAL from "ical.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  CALENDAR_ICS_URL,
  CALENDAR_TIMEZONE,
  EVENT_COLORS,
} from "@/constants/calendar";

dayjs.extend(utc);
dayjs.extend(timezone);

// 單一重複事件最多展開的次數，避免無窮 RRULE 卡住頁面
const MAX_OCCURRENCES = 10000;

export function toCalendarDay(date) {
  return dayjs(date).tz(CALENDAR_TIMEZONE);
}

// "YYYY-MM-DD" 視為日曆時區的日期（不受瀏覽器所在時區影響）
export function fromDayKey(key) {
  return dayjs.tz(key, CALENDAR_TIMEZONE);
}

export function todayInCalendar() {
  return dayjs().tz(CALENDAR_TIMEZONE);
}

function pickColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

// Google 日曆的描述可能含 HTML，轉成純文字再交給畫面處理
function htmlToText(value) {
  if (!value) return "";
  const withBreaks = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// ICAL.Time（全天）轉成日曆時區的當天 00:00
function dateOnlyToDay(time) {
  return dayjs.tz(
    `${time.year}-${String(time.month).padStart(2, "0")}-${String(
      time.day
    ).padStart(2, "0")}`,
    CALENDAR_TIMEZONE
  );
}

function buildOccurrence(item, startTime, endTime, masterUid) {
  const allDay = startTime.isDate;
  const start = allDay
    ? dateOnlyToDay(startTime)
    : toCalendarDay(startTime.toJSDate());
  let end;
  if (endTime) {
    end = allDay ? dateOnlyToDay(endTime) : toCalendarDay(endTime.toJSDate());
  } else {
    end = allDay ? start.add(1, "day") : start;
  }
  return {
    id: `${masterUid}_${start.valueOf()}`,
    uid: masterUid,
    title: item.summary || "（無標題）",
    location: item.location || "",
    description: htmlToText(item.description),
    allDay,
    start,
    end,
    color: pickColor(masterUid),
  };
}

export default class CalendarService {
  constructor() {
    this.events = [];
  }

  async load() {
    const response = await fetch(CALENDAR_ICS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`日曆讀取失敗（HTTP ${response.status}）`);
    }
    const text = await response.text();
    this.parse(text);
    return this;
  }

  parse(text) {
    const root = new ICAL.Component(ICAL.parse(text));
    root
      .getAllSubcomponents("vtimezone")
      .forEach((tz) => ICAL.TimezoneService.register(tz));

    const masters = {};
    const exceptions = [];
    root.getAllSubcomponents("vevent").forEach((vevent) => {
      const event = new ICAL.Event(vevent);
      if (event.isRecurrenceException()) {
        exceptions.push(event);
      } else {
        masters[event.uid] = event;
      }
    });
    exceptions.forEach((exception) => {
      const master = masters[exception.uid];
      if (master) {
        master.relateException(exception);
      } else {
        // 只剩單筆例外（主事件已刪除）時就當一般事件顯示
        masters[`${exception.uid}_${exception.recurrenceId}`] = exception;
      }
    });
    this.events = Object.values(masters);
  }

  // 回傳 [rangeStart, rangeEnd) 之間的所有事件，已依開始時間排序
  getOccurrences(rangeStart, rangeEnd) {
    const startMs = rangeStart.valueOf();
    const endMs = rangeEnd.valueOf();
    const overlaps = (occ) =>
      occ.start.valueOf() < endMs &&
      Math.max(occ.end.valueOf(), occ.start.valueOf() + 1) > startMs;

    const result = [];
    this.events.forEach((event) => {
      if (isCancelled(event)) return;
      if (!event.isRecurring()) {
        const occ = buildOccurrence(
          event,
          event.startDate,
          event.endDate,
          event.uid
        );
        if (overlaps(occ)) result.push(occ);
        return;
      }
      const iterator = event.iterator();
      let next;
      let count = 0;
      while ((next = iterator.next()) && count < MAX_OCCURRENCES) {
        count++;
        // 以原始排程時間判斷是否超出範圍（例外事件可能被改到別天）
        if (next.toJSDate().valueOf() >= endMs + 31 * 864e5) break;
        const details = event.getOccurrenceDetails(next);
        if (isCancelled(details.item)) continue;
        const occ = buildOccurrence(
          details.item,
          details.startDate,
          details.endDate,
          event.uid
        );
        if (overlaps(occ)) result.push(occ);
      }
    });
    return result.sort(
      (a, b) =>
        a.start.valueOf() - b.start.valueOf() ||
        Number(b.allDay) - Number(a.allDay)
    );
  }
}

function isCancelled(event) {
  const status = event.component.getFirstPropertyValue("status");
  return status && String(status).toUpperCase() === "CANCELLED";
}
