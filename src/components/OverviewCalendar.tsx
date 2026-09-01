"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  format,
  isSameMonth,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import {
  Beaker,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  calendarDateKey,
  calendarMonthKey,
  getCalendarGrid,
  groupCalendarActivities,
  parseCalendarMonth,
  type OverviewCalendarActivity,
} from "@/lib/overview-calendar";

function monthHref(month: Date) {
  return `/?month=${calendarMonthKey(month)}`;
}

function activityColor(kind: OverviewCalendarActivity["kind"]) {
  return kind === "entry" ? "bg-info" : "bg-moss";
}

export function OverviewCalendar({
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
  const dateLocale = locale === "zh" ? zhCN : enUS;
  const viewMonth = useMemo(() => parseCalendarMonth(monthKey), [monthKey]);
  const days = useMemo(() => getCalendarGrid(viewMonth), [viewMonth]);
  const activitiesByDate = useMemo(() => groupCalendarActivities(activities), [activities]);
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedDateKey);
  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);
  const selectedActivities = activitiesByDate.get(selectedDateKey) ?? [];
  const weekdayLabels = days.slice(0, 7).map((day) => format(day, "EEEEE", { locale: dateLocale }));
  const monthLabel = locale === "zh"
    ? `${format(viewMonth, "yyyy")}年${format(viewMonth, "M")}月`
    : format(viewMonth, "MMMM yyyy", { locale: dateLocale });
  const selectedDateLabel = locale === "zh"
    ? `${format(selectedDate, "M")}月${format(selectedDate, "d")}日 ${format(selectedDate, "EEEE", { locale: dateLocale })}`
    : format(selectedDate, "EEEE, MMMM d", { locale: dateLocale });

  return (
    <div className="space-y-5">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader
          title={t("Calendar")}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={monthHref(addMonths(viewMonth, -1))}
                aria-label={t("Previous month")}
                title={t("Previous month")}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-md)] text-muted transition hover:bg-stone/70 hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Link>
              <span className="w-28 text-center text-sm font-medium text-ink sm:w-36" data-i18n-ignore>
                {monthLabel}
              </span>
              <Link
                href={monthHref(addMonths(viewMonth, 1))}
                aria-label={t("Next month")}
                title={t("Next month")}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-md)] text-muted transition hover:bg-stone/70 hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/"
                className="focus-ring ml-1 hidden h-8 items-center rounded-[var(--ln-radius-control-md)] border border-hairline px-2.5 text-xs text-moss transition hover:border-border-strong hover:bg-warm sm:inline-flex"
              >
                {t("Today")}
              </Link>
            </div>
          }
        />
        <CardBody className="p-0">
          <section aria-label={t("Monthly calendar")} className="min-w-0 p-3 sm:p-4">
            <div className="grid grid-cols-7 border-b border-hairline pb-1.5">
              {weekdayLabels.map((label, index) => (
                <span key={`${label}-${index}`} className="text-center text-[11px] font-medium uppercase tracking-[0.08em] text-muted" data-i18n-ignore>
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateKey = calendarDateKey(day);
                const dayActivities = activitiesByDate.get(dateKey) ?? [];
                const inCurrentMonth = isSameMonth(day, viewMonth);
                const isSelected = dateKey === selectedDateKey;
                const isToday = dateKey === todayKey;
                const dayLabel = locale === "zh"
                  ? `${format(day, "yyyy")}年${format(day, "M")}月${format(day, "d")}日 ${format(day, "EEEE", { locale: dateLocale })}`
                  : format(day, "EEEE, MMMM d, yyyy", { locale: dateLocale });
                const sharedClass = cn(
                  "focus-ring relative flex min-h-11 min-w-0 flex-col rounded-[var(--ln-radius-control-md)] border p-1.5 text-left transition sm:min-h-14",
                  inCurrentMonth ? "border-transparent hover:border-hairline hover:bg-warm" : "border-transparent text-disabled hover:bg-warm/70",
                  isSelected && "border-sage bg-sage-surface/70 hover:border-sage hover:bg-sage-surface/70",
                  isToday && !isSelected && "border-hairline bg-warm",
                );

                if (!inCurrentMonth) {
                  return (
                    <Link key={dateKey} href={monthHref(day)} className={sharedClass} aria-label={dayLabel}>
                      <span className="text-xs font-medium" data-i18n-ignore>{format(day, "d")}</span>
                    </Link>
                  );
                }

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(dateKey)}
                    className={sharedClass}
                    aria-label={`${dayLabel}, ${dayActivities.length} ${t(dayActivities.length === 1 ? "activity" : "activities")}`}
                    aria-pressed={isSelected}
                  >
                    <span className={cn("text-xs font-medium", isToday ? "text-moss" : "text-ink")} data-i18n-ignore>
                      {format(day, "d")}
                    </span>
                    <span className="mt-auto hidden min-w-0 space-y-1 sm:block">
                      {dayActivities.slice(0, 1).map((activity) => (
                        <span key={activity.id} className="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-graphite">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", activityColor(activity.kind))} aria-hidden />
                          <span className="truncate" data-i18n-ignore>{activity.title}</span>
                        </span>
                      ))}
                      {dayActivities.length > 1 ? (
                        <span className="block pl-2.5 text-[10px] leading-3 text-muted" data-i18n-ignore>+{dayActivities.length - 1}</span>
                      ) : null}
                    </span>
                    {dayActivities.length ? (
                      <span className="mt-auto flex flex-wrap gap-1 sm:hidden" aria-hidden>
                        {dayActivities.slice(0, 3).map((activity) => (
                          <span key={activity.id} className={cn("h-1.5 w-1.5 rounded-full", activityColor(activity.kind))} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-2.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" aria-hidden />{t("Entries")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-moss" aria-hidden />{t("Experiments")}</span>
            </div>
          </section>
        </CardBody>
      </Card>

      <section className="min-w-0" aria-label={t("Daily activities")}>
        <Card className="overflow-hidden">
          <div className="border-b border-hairline bg-warm/45 px-4 py-3 sm:px-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink" data-i18n-ignore>{selectedDateLabel}</h3>
              <span className="shrink-0 font-mono text-[11px] text-muted" data-i18n-ignore>
                {locale === "zh" ? `${selectedActivities.length} 项` : `${selectedActivities.length} ${selectedActivities.length === 1 ? "item" : "items"}`}
              </span>
            </div>
          </div>
          <div className="grid gap-px bg-hairline md:grid-cols-2">
            {selectedActivities.length ? selectedActivities.map((activity) => {
              const Icon = activity.kind === "entry" ? BookOpen : Beaker;
              return (
                <Link key={activity.id} href={activity.href} className="focus-ring group block bg-surface px-4 py-3 transition hover:bg-warm/60 sm:px-5 sm:py-4">
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                      <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-[var(--ln-radius-control-md)]",
                        activity.kind === "entry" ? "bg-info-surface text-info" : "bg-sage-surface text-moss",
                      )}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      {t(activity.kind === "entry" ? "Entry" : "Experiment")}
                    </span>
                    <StatusPill status={activity.status} />
                  </span>
                  <span className="mt-2 block text-sm font-semibold leading-5 text-ink group-hover:underline" data-i18n-ignore>{activity.title}</span>
                  {activity.summary ? (
                    <span className="mt-1.5 line-clamp-3 text-xs leading-5 text-graphite" data-i18n-ignore>{activity.summary}</span>
                  ) : null}
                  <span className="mt-2 block truncate text-[11px] text-muted">
                    {activity.kind === "entry" ? format(new Date(activity.startsAt), "HH:mm") : t("Experiment date")}
                    {activity.context ? <> · <span data-i18n-ignore>{activity.context}</span></> : null}
                  </span>
                </Link>
              );
            }) : (
              <div className="bg-surface px-4 py-8 text-center md:col-span-2">
                <p className="text-sm font-medium text-ink">{t("No activities for this day.")}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{t("Entries and experiment dates will appear here automatically.")}</p>
                <Link href="/entries/new" className="focus-ring mt-3 inline-flex text-sm font-medium text-moss hover:underline">
                  {t("Add an entry")}
                </Link>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
