"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addMonths, format, isSameMonth } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Beaker, BookOpen, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { StatusPill } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  calendarDateKey,
  calendarMonthKey,
  getCalendarGrid,
  groupCalendarActivities,
  parseCalendarMonth,
  type OverviewCalendarActivity,
} from "@/lib/overview-calendar";

const agendaLimit = 4;

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// A week strip for the phone home that opens into the month in place; the selected day's entries and
// experiments are listed below it without leaving Today.
export function MobileWeekCalendar({
  monthKey,
  todayKey,
  initialSelectedDateKey,
  activities,
}: {
  monthKey: string;
  todayKey: string;
  initialSelectedDateKey: string;
  activities: OverviewCalendarActivity[];
}) {
  const { locale, t } = useI18n();
  const zh = locale === "zh";
  const dateLocale = zh ? zhCN : enUS;
  const viewMonth = useMemo(() => parseCalendarMonth(monthKey), [monthKey]);
  const weeks = useMemo(() => {
    const days = getCalendarGrid(viewMonth);
    return Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  }, [viewMonth]);
  const activitiesByDate = useMemo(() => groupCalendarActivities(activities), [activities]);
  const weekOf = (key: string) => Math.max(0, weeks.findIndex((week) => week.some((day) => calendarDateKey(day) === key)));
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedDateKey);
  const [weekIndex, setWeekIndex] = useState(() => weekOf(initialSelectedDateKey));
  const [expanded, setExpanded] = useState(false);
  const touchStart = useRef<number | null>(null);

  const isCurrentMonth = monthKey === todayKey.slice(0, 7);
  // Selecting a day always moves to its week, so today selected means today's week is showing.
  const showingToday = isCurrentMonth && selectedDateKey === todayKey;
  const visibleDays = expanded ? weeks.flat().filter((day) => isSameMonth(day, viewMonth)) : weeks[weekIndex];
  const visibleCount = visibleDays.reduce((sum, day) => sum + (activitiesByDate.get(calendarDateKey(day))?.length ?? 0), 0);
  const selectedActivities = activitiesByDate.get(selectedDateKey) ?? [];
  const selectedDate = dateFromKey(selectedDateKey);
  const weekdayLabels = weeks[0].map((day) => format(day, zh ? "EEEEE" : "EEEEEE", { locale: dateLocale }));

  const monthLabel = zh ? `${format(viewMonth, "yyyy")}年${format(viewMonth, "M")}月` : format(viewMonth, "MMMM yyyy", { locale: dateLocale });
  const weekStart = weeks[weekIndex][0];
  const weekEnd = weeks[weekIndex][6];
  const rangeLabel = expanded
    ? (zh ? `本月 ${visibleCount} 项` : `${visibleCount} this month`)
    : zh
      ? `${format(weekStart, "M月d日")} – ${format(weekEnd, isSameMonth(weekStart, weekEnd) ? "d日" : "M月d日")} · ${visibleCount} 项`
      : `${format(weekStart, "MMM d")} – ${format(weekEnd, isSameMonth(weekStart, weekEnd) ? "d" : "MMM d")} · ${visibleCount} ${visibleCount === 1 ? "item" : "items"}`;
  const selectedDayLabel = zh ? `${format(selectedDate, "M月d日")} ${format(selectedDate, "EEEE", { locale: dateLocale })}` : format(selectedDate, "EEEE, MMMM d");
  const selectedLabel = selectedDateKey === todayKey ? `${zh ? "今天" : "Today"} · ${selectedDayLabel}` : selectedDayLabel;

  function stepWeek(delta: number) {
    const next = Math.min(5, Math.max(0, weekIndex + delta));
    if (next === weekIndex) return;
    setWeekIndex(next);
    const inMonth = weeks[next].find((day) => isSameMonth(day, viewMonth)) ?? weeks[next][0];
    setSelectedDateKey(weeks[next].some((day) => calendarDateKey(day) === todayKey) ? todayKey : calendarDateKey(inMonth));
  }

  function selectDay(key: string) {
    setSelectedDateKey(key);
    setWeekIndex(weekOf(key));
  }

  const navButton = "focus-ring flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-stone/70 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      <div className="flex items-center gap-1 py-1 pl-4 pr-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink" data-i18n-ignore>{monthLabel}</p>
          <p className="truncate text-xs text-muted" data-i18n-ignore>{rangeLabel}</p>
        </div>
        {!showingToday ? (
          isCurrentMonth
            ? <button type="button" onClick={() => selectDay(todayKey)} className="focus-ring flex h-11 items-center rounded-full px-3 text-xs font-semibold text-moss">{t("Today")}</button>
            : <Link href="/" className="focus-ring flex h-11 items-center rounded-full px-3 text-xs font-semibold text-moss">{t("Today")}</Link>
        ) : null}
        {expanded ? <>
          <Link href={`/?month=${calendarMonthKey(addMonths(viewMonth, -1))}`} aria-label={t("Previous month")} className={navButton}><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
          <Link href={`/?month=${calendarMonthKey(addMonths(viewMonth, 1))}`} aria-label={t("Next month")} className={navButton}><ChevronRight className="h-4 w-4" aria-hidden /></Link>
        </> : <>
          <button type="button" onClick={() => stepWeek(-1)} disabled={weekIndex === 0} aria-label={t("Previous week")} className={navButton}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={() => stepWeek(1)} disabled={weekIndex === 5} aria-label={t("Next week")} className={navButton}><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </>}
      </div>

      <div
        className="px-2 pb-1"
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (expanded || start === null || end === undefined || Math.abs(end - start) < 48) return;
          stepWeek(end < start ? 1 : -1);
        }}
      >
        <div className="grid grid-cols-7" aria-hidden>
          {weekdayLabels.map((label, index) => (
            <span key={index} className={cn("pb-1 text-center text-xs font-medium uppercase tracking-[0.08em]", index > 4 ? "text-disabled" : "text-muted")} data-i18n-ignore>{label}</span>
          ))}
        </div>
        {weeks.map((week, index) => {
          const open = expanded || index === weekIndex;
          return (
            <div key={index} className={cn("ln-mobile-calendar-week grid", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
              <div className="grid min-h-0 grid-cols-7 overflow-hidden">
                {week.map((day) => {
                  const key = calendarDateKey(day);
                  const dayActivities = activitiesByDate.get(key) ?? [];
                  const inMonth = isSameMonth(day, viewMonth);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDateKey;
                  const dayLabel = zh
                    ? `${format(day, "M月d日")} ${format(day, "EEEE", { locale: dateLocale })}，${dayActivities.length} 项`
                    : `${format(day, "EEEE, MMMM d")}, ${dayActivities.length} ${dayActivities.length === 1 ? "item" : "items"}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectDay(key)}
                      aria-pressed={isSelected}
                      aria-label={dayLabel}
                      className="focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)]"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                          isToday ? "bg-action font-semibold text-warm" : isSelected ? "bg-sage-surface font-semibold text-moss ring-1 ring-sage" : inMonth ? "text-ink" : "text-disabled",
                          isToday && isSelected && "ring-2 ring-action/25 ring-offset-2 ring-offset-surface",
                        )}
                        data-i18n-ignore
                      >
                        {format(day, "d")}
                      </span>
                      <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                        {dayActivities.slice(0, 3).map((activity) => (
                          <span key={activity.id} className={cn("h-1 w-1 rounded-full", activity.kind === "entry" ? "bg-info" : "bg-moss", !inMonth && "opacity-40")} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={t(expanded ? "Show week" : "Show month")}
          className="focus-ring mx-auto flex h-11 w-20 items-center justify-center rounded-full text-muted"
        >
          <span className="h-1 w-8 rounded-full bg-hairline" aria-hidden />
          <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>

      <div className="border-t border-hairline">
        <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
          <h3 className="text-xs font-semibold text-graphite" data-i18n-ignore>{selectedLabel}</h3>
          <span className="shrink-0 font-mono text-xs text-muted" data-i18n-ignore>{zh ? `${selectedActivities.length} 项` : `${selectedActivities.length} ${selectedActivities.length === 1 ? "item" : "items"}`}</span>
        </div>
        {selectedActivities.length ? (
          <ul className="pb-1">
            {selectedActivities.slice(0, agendaLimit).map((activity) => {
              const Icon = activity.kind === "entry" ? BookOpen : Beaker;
              return (
                <li key={activity.id}>
                  <Link href={activity.href} className="focus-ring flex min-h-12 items-center gap-3 px-4 py-2 transition-colors active:bg-warm">
                    <span className={cn("h-8 w-0.5 shrink-0 rounded-full", activity.kind === "entry" ? "bg-info" : "bg-moss")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink" data-i18n-ignore>{activity.title}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <Icon className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="shrink-0">{t(activity.kind === "entry" ? "Entry" : "Experiment")}</span>
                        {activity.timeLabel ? <span className="shrink-0 font-mono" data-i18n-ignore>{activity.timeLabel}</span> : null}
                        {activity.context ? <span className="truncate" data-i18n-ignore>· {activity.context}</span> : null}
                      </span>
                    </span>
                    <StatusPill status={activity.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 pb-4 pt-1 text-sm text-muted">{t("No activities for this day.")}</p>
        )}
        {selectedActivities.length > agendaLimit ? (
          <Link href={`/?month=${monthKey}&view=calendar`} className="focus-ring flex min-h-11 items-center border-t border-hairline px-4 text-xs font-medium text-moss" data-i18n-ignore>
            {zh ? `还有 ${selectedActivities.length - agendaLimit} 项，在月历中查看` : `${selectedActivities.length - agendaLimit} more in the monthly calendar`}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
