<template>
  <div class="CalendarPage">
    <div class="toolbar">
      <div class="toolbar__nav">
        <button
          class="btn btn--icon"
          @click="shiftMonth(-1)"
          aria-label="上個月"
        >
          ‹
        </button>
        <h2 class="toolbar__title">
          {{ cursor.format("YYYY 年 M 月") }}
        </h2>
        <button
          class="btn btn--icon"
          @click="shiftMonth(1)"
          aria-label="下個月"
        >
          ›
        </button>
        <button class="btn" @click="goToday">今天</button>
      </div>
      <div class="toolbar__actions">
        <div class="segmented">
          <button
            :class="{ active: viewMode === 'month' }"
            @click="viewMode = 'month'"
          >
            月曆
          </button>
          <button
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            清單
          </button>
        </div>
        <button
          class="btn"
          :disabled="loading"
          @click="loadCalendar"
          title="重新同步"
        >
          {{ loading ? "同步中…" : "重新整理" }}
        </button>
      </div>
    </div>

    <div v-if="error" class="notice notice--error">
      {{ error }}
      <a :href="webUrl" target="_blank" rel="noopener">改用 Google 日曆開啟</a>
    </div>

    <div class="layout">
      <!-- 月曆 -->
      <div v-if="viewMode === 'month'" class="month card">
        <div class="month__weekdays">
          <div
            v-for="(label, index) in weekdayLabels"
            :key="label"
            class="month__weekday"
            :class="{ weekend: index === 0 || index === 6 }"
          >
            {{ label }}
          </div>
        </div>
        <div class="month__grid" :class="{ loading: loading && !loaded }">
          <div
            v-for="day in gridDays"
            :key="day.key"
            class="day"
            :class="{
              'day--outside': !day.inMonth,
              'day--today': day.key === todayKey,
              'day--selected': day.key === selectedKey,
              'day--has-events': day.events.length,
            }"
            @click="selectDay(day)"
          >
            <div class="day__number">{{ day.date.date() }}</div>
            <div class="day__events">
              <div
                v-for="event in day.events.slice(0, maxChips)"
                :key="event.id"
                class="chip"
                :class="{ 'chip--allday': event.allDay }"
                :style="chipStyle(event)"
                @click.stop="openEvent(event)"
              >
                <span v-if="!event.allDay" class="chip__time">
                  {{ event.start.format("HH:mm") }}
                </span>
                {{ event.title }}
              </div>
              <div v-if="day.events.length > maxChips" class="day__more">
                還有 {{ day.events.length - maxChips }} 個
              </div>
            </div>
            <div class="day__dots">
              <span
                v-for="event in day.events.slice(0, 3)"
                :key="event.id"
                :style="{ background: event.color }"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 清單 -->
      <div v-else class="agenda card">
        <div v-if="!monthGroups.length" class="empty">
          {{ loading ? "同步中…" : "這個月沒有活動" }}
        </div>
        <div
          v-for="group in monthGroups"
          :key="group.key"
          class="agenda__group"
          :class="{ 'agenda__group--today': group.key === todayKey }"
        >
          <div class="agenda__date">
            <div class="agenda__day">{{ group.date.date() }}</div>
            <div class="agenda__weekday">
              週{{ weekdayLabels[group.date.day()] }}
            </div>
          </div>
          <div class="agenda__events">
            <event-row
              v-for="event in group.events"
              :key="event.id"
              :event="event"
              @select="openEvent"
            />
          </div>
        </div>
      </div>

      <!-- 側欄：選取日期 + 即將到來 -->
      <aside class="side">
        <div class="card side__section">
          <h3 class="side__title">
            {{ selectedDate.format("M 月 D 日") }}
            <small>週{{ weekdayLabels[selectedDate.day()] }}</small>
          </h3>
          <div v-if="!selectedEvents.length" class="empty empty--small">
            沒有活動
          </div>
          <event-row
            v-for="event in selectedEvents"
            :key="event.id"
            :event="event"
            @select="openEvent"
          />
        </div>
        <div class="card side__section">
          <h3 class="side__title">即將到來</h3>
          <div v-if="!upcoming.length" class="empty empty--small">
            {{ loading ? "同步中…" : "近期沒有活動" }}
          </div>
          <event-row
            v-for="event in upcoming"
            :key="event.id"
            :event="event"
            show-date
            @select="openEvent"
          />
        </div>
        <div class="side__meta">
          <span v-if="lastSynced">
            最後同步 {{ lastSynced.format("HH:mm") }}
          </span>
          <a :href="webUrl" target="_blank" rel="noopener"
            >在 Google 日曆開啟</a
          >
        </div>
      </aside>
    </div>

    <!-- 活動詳細 -->
    <transition name="fade">
      <div v-if="activeEvent" class="modal" @click.self="activeEvent = null">
        <div class="modal__panel">
          <div
            class="modal__bar"
            :style="{ background: activeEvent.color }"
          ></div>
          <button class="modal__close" @click="activeEvent = null">×</button>
          <h3 class="modal__title">{{ activeEvent.title }}</h3>
          <div class="modal__row">🕒 {{ formatRange(activeEvent) }}</div>
          <div v-if="activeEvent.location" class="modal__row">
            📍
            <a
              :href="mapUrl(activeEvent.location)"
              target="_blank"
              rel="noopener"
              >{{ activeEvent.location }}</a
            >
          </div>
          <div v-if="activeEvent.description" class="modal__desc">
            <template v-for="(part, index) in linkify(activeEvent.description)">
              <a
                v-if="part.url"
                :key="index"
                :href="part.url"
                target="_blank"
                rel="noopener"
                >{{ part.text }}</a
              >
              <span v-else :key="index">{{ part.text }}</span>
            </template>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import dayjs from "dayjs";
import CalendarService, {
  fromDayKey,
  toCalendarDay,
  todayInCalendar,
} from "@/utils/CalendarService";
import { CALENDAR_WEB_URL, WEEKDAY_LABELS } from "@/constants/calendar";

const DAY_FORMAT = "YYYY-MM-DD";
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

// 月曆格子一律用「不帶時區」的日期計算，只以 YYYY-MM-DD 字串跟事件對應，
// 避免瀏覽器不在台灣時區時日期位移
function dayFromKey(key) {
  return dayjs(key);
}

function dayKey(time) {
  return time.format(DAY_FORMAT);
}

// 事件最後涵蓋到的日期（結束於 00:00 時不算進當天）
function lastDayKey(event) {
  if (event.end.valueOf() <= event.start.valueOf()) return dayKey(event.start);
  return dayKey(toCalendarDay(event.end.valueOf() - 1));
}

function formatRange(event) {
  const { start, end, allDay } = event;
  const weekday = (d) => `（${WEEKDAY_LABELS[d.day()]}）`;
  if (allDay) {
    const lastDay = dayFromKey(lastDayKey(event));
    if (lastDayKey(event) === dayKey(start)) {
      return `${start.format("M/D")}${weekday(start)} 全天`;
    }
    return `${start.format("M/D")}${weekday(start)} – ${lastDay.format(
      "M/D"
    )}${weekday(lastDay)}`;
  }
  if (lastDayKey(event) === dayKey(start)) {
    return `${start.format("M/D")}${weekday(start)} ${start.format(
      "HH:mm"
    )} – ${end.format("HH:mm")}`;
  }
  return `${start.format("M/D HH:mm")} – ${end.format("M/D HH:mm")}`;
}

const EventRow = {
  name: "EventRow",
  props: {
    event: { type: Object, required: true },
    showDate: { type: Boolean, default: false },
  },
  render(h) {
    const { event, showDate } = this;
    let time;
    if (showDate) {
      time = formatRange(event);
    } else if (event.allDay) {
      time = "全天";
    } else {
      time = `${event.start.format("HH:mm")} – ${event.end.format("HH:mm")}`;
    }
    return h(
      "div",
      {
        class: "eventRow",
        on: { click: () => this.$emit("select", event) },
      },
      [
        h("span", {
          class: "eventRow__bar",
          style: { background: event.color },
        }),
        h("div", { class: "eventRow__body" }, [
          h("div", { class: "eventRow__title" }, event.title),
          h("div", { class: "eventRow__time" }, time),
          event.location
            ? h("div", { class: "eventRow__location" }, `📍 ${event.location}`)
            : null,
        ]),
      ]
    );
  },
};

export default {
  name: "CalendarPage",
  components: { EventRow },
  data() {
    const todayKey = dayKey(todayInCalendar());
    return {
      service: new CalendarService(),
      cursor: dayFromKey(todayKey).startOf("month"),
      selectedKey: todayKey,
      todayKey,
      viewMode: "month",
      loading: false,
      loaded: false,
      error: "",
      lastSynced: null,
      activeEvent: null,
      weekdayLabels: WEEKDAY_LABELS,
      webUrl: CALENDAR_WEB_URL,
      maxChips: 3,
      // 每次重新同步後遞增，讓 computed 重新展開事件
      version: 0,
    };
  },
  computed: {
    gridStart() {
      return this.cursor.startOf("month").subtract(this.cursor.day(), "day");
    },
    gridEnd() {
      const monthEnd = this.cursor.endOf("month").startOf("day");
      return monthEnd.add(7 - monthEnd.day(), "day");
    },
    occurrences() {
      // eslint-disable-next-line no-unused-expressions
      this.version;
      if (!this.loaded) return [];
      return this.service.getOccurrences(
        fromDayKey(dayKey(this.gridStart)),
        fromDayKey(dayKey(this.gridEnd))
      );
    },
    eventsByDay() {
      const map = {};
      this.occurrences.forEach((event) => {
        // 跨日事件在每一天都顯示
        const lastKey = lastDayKey(event);
        let day = dayFromKey(dayKey(event.start));
        while (dayKey(day) <= lastKey) {
          const key = dayKey(day);
          (map[key] = map[key] || []).push(event);
          day = day.add(1, "day");
        }
      });
      return map;
    },
    gridDays() {
      const days = [];
      for (
        let day = this.gridStart;
        day.isBefore(this.gridEnd);
        day = day.add(1, "day")
      ) {
        const key = day.format(DAY_FORMAT);
        days.push({
          key,
          date: day,
          inMonth: day.month() === this.cursor.month(),
          events: this.eventsByDay[key] || [],
        });
      }
      return days;
    },
    monthGroups() {
      return this.gridDays.filter((day) => day.inMonth && day.events.length);
    },
    selectedDate() {
      return dayFromKey(this.selectedKey);
    },
    selectedEvents() {
      return this.eventsByDay[this.selectedKey] || [];
    },
    upcoming() {
      // eslint-disable-next-line no-unused-expressions
      this.version;
      if (!this.loaded) return [];
      const now = dayjs();
      return this.service
        .getOccurrences(now, now.add(60, "day"))
        .filter((event) => event.end.valueOf() > now.valueOf())
        .slice(0, 6);
    },
  },
  mounted() {
    this.loadCalendar();
    window.addEventListener("keydown", this.handleKeydown);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.handleKeydown);
  },
  methods: {
    async loadCalendar() {
      this.loading = true;
      this.error = "";
      try {
        await this.service.load();
        this.loaded = true;
        this.version++;
        this.lastSynced = todayInCalendar();
        this.todayKey = dayKey(this.lastSynced);
      } catch (err) {
        console.error(err);
        this.error = "無法同步日曆，請稍後再試。";
      } finally {
        this.loading = false;
      }
    },
    shiftMonth(step) {
      this.cursor = this.cursor.add(step, "month");
      this.selectedKey = dayKey(this.cursor);
    },
    goToday() {
      this.todayKey = dayKey(todayInCalendar());
      this.cursor = dayFromKey(this.todayKey).startOf("month");
      this.selectedKey = this.todayKey;
    },
    selectDay(day) {
      this.selectedKey = day.key;
      if (!day.inMonth) {
        this.cursor = day.date.startOf("month");
      }
    },
    openEvent(event) {
      this.activeEvent = event;
    },
    handleKeydown(e) {
      if (e.key === "Escape") this.activeEvent = null;
    },
    chipStyle(event) {
      return event.allDay
        ? { background: event.color, color: "#fff" }
        : { borderLeftColor: event.color };
    },
    formatRange,
    mapUrl(location) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
    },
    linkify(text) {
      return text
        .split(URL_PATTERN)
        .filter((part) => part)
        .map((part) =>
          /^https?:\/\//.test(part) ? { text: part, url: part } : { text: part }
        );
    },
  },
};
</script>

<style lang="scss" scoped>
$primary: #1d80ff;
$border: #eef0f3;
$muted: #8a94a6;

.CalendarPage {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 0 40px;
  text-align: left;
}

.card {
  background: #fff;
  border: 1px solid $border;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(20, 30, 60, 0.04);
}

.btn {
  padding: 8px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #2c3e50;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &--icon {
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 22px;
    line-height: 1;
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  &__nav,
  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    margin: 0 4px;
    min-width: 150px;
    text-align: center;
    font-size: 22px;
    font-weight: 700;

    @include mobile {
      min-width: 120px;
      font-size: 18px;
    }
  }

  @include mobile {
    flex-direction: column;
    align-items: stretch;

    &__nav,
    &__actions {
      justify-content: space-between;
    }
  }
}

.segmented {
  display: inline-flex;
  padding: 3px;
  background: #f1f3f6;
  border-radius: 8px;

  button {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: $muted;
    font-size: 14px;
    cursor: pointer;

    &.active {
      background: #fff;
      color: $primary;
      font-weight: 700;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  }
}

.notice {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 8px;

  &--error {
    background: #fff1f2;
    color: #d33;
  }

  a {
    margin-left: 8px;
    color: $primary;
  }
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;

  @include mobile-and-tablet {
    grid-template-columns: minmax(0, 1fr);
  }
}

// 月曆
.month {
  overflow: hidden;

  &__weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid $border;
  }

  &__weekday {
    padding: 10px 0;
    text-align: center;
    font-size: 13px;
    color: $muted;

    &.weekend {
      color: #e57373;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    transition: opacity 0.2s ease;

    &.loading {
      opacity: 0.5;
    }
  }
}

.day {
  min-height: 110px;
  padding: 6px;
  border-right: 1px solid $border;
  border-bottom: 1px solid $border;
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 0;

  &:nth-child(7n) {
    border-right: none;
  }

  &:hover {
    background: #f8fafd;
  }

  &--outside {
    background: #fbfbfc;

    .day__number {
      color: #c3c9d4;
    }
  }

  &--selected {
    background: #f0f7ff;
  }

  &__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin-bottom: 4px;
    border-radius: 50%;
    font-size: 13px;
  }

  &--today &__number {
    background: $primary;
    color: #fff;
    font-weight: 700;
  }

  &__events {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__more {
    padding-left: 4px;
    font-size: 12px;
    color: $muted;
  }

  &__dots {
    display: none;
  }

  @include mobile {
    min-height: 56px;
    padding: 4px 2px;
    text-align: center;

    &__events {
      display: none;
    }

    &__dots {
      display: flex;
      justify-content: center;
      gap: 3px;

      span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
    }
  }
}

.chip {
  padding: 2px 6px;
  border-left: 3px solid $primary;
  border-radius: 4px;
  background: #f4f6fa;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  &:hover {
    filter: brightness(0.96);
  }

  &--allday {
    border-left: none;
    padding-left: 8px;
  }

  &__time {
    color: $muted;
    margin-right: 2px;
  }
}

// 清單
.agenda {
  padding: 8px 0;

  &__group {
    display: flex;
    gap: 16px;
    padding: 12px 20px;
    border-bottom: 1px solid $border;

    &:last-child {
      border-bottom: none;
    }

    &--today .agenda__day {
      background: $primary;
      color: #fff;
    }
  }

  &__date {
    flex: 0 0 52px;
    text-align: center;
  }

  &__day {
    width: 40px;
    height: 40px;
    margin: 0 auto;
    border-radius: 50%;
    line-height: 40px;
    font-size: 20px;
    font-weight: 700;
  }

  &__weekday {
    font-size: 12px;
    color: $muted;
  }

  &__events {
    flex: 1;
    min-width: 0;
  }
}

// 側欄
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__section {
    padding: 16px;
  }

  &__title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 700;

    small {
      margin-left: 6px;
      font-size: 13px;
      color: $muted;
      font-weight: 500;
    }
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: $muted;

    a {
      color: $primary;
      text-decoration: none;
    }
  }
}

.empty {
  padding: 40px 0;
  text-align: center;
  color: $muted;

  &--small {
    padding: 8px 0;
    text-align: left;
    font-size: 14px;
  }
}

::v-deep .eventRow {
  display: flex;
  gap: 10px;
  padding: 8px;
  margin: 0 -8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f6f8fb;
  }

  &__bar {
    flex: 0 0 4px;
    border-radius: 2px;
  }

  &__body {
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    word-break: break-word;
  }

  &__time,
  &__location {
    margin-top: 2px;
    font-size: 13px;
    color: $muted;
  }
}

// 活動詳細
.modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 30, 50, 0.45);

  @include mobile {
    align-items: flex-end;
    padding: 0;
  }

  &__panel {
    position: relative;
    width: 100%;
    max-width: 460px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 24px;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);

    @include mobile {
      max-width: none;
      border-radius: 16px 16px 0 0;
    }
  }

  &__bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
  }

  &__close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: #f1f3f6;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  &__title {
    margin: 4px 36px 14px 0;
    font-size: 20px;
    font-weight: 700;
  }

  &__row {
    margin-bottom: 8px;
    font-size: 14px;

    a {
      color: $primary;
    }
  }

  &__desc {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid $border;
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;

    a {
      color: $primary;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
