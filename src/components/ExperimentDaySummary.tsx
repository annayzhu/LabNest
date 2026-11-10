"use client";

import { useI18n } from "./I18nProvider";
import { dayContent, dayRunLabel, dayRuns, dayStatusLabel, dayWaitLabel, type ExperimentDay } from "@/lib/experiment-days";
import "./experiment-day-summary.css";

/**
 * 日程 at the head of 实验设置与样本 (Q432): one tile per day — which day, its date, the wait after the day before, what it
 * holds, how far it is. Empty days in a row share one tile. Read only: a tile jumps to that day in 执行记录; times are changed on the schedule page.
 */
export function ExperimentDaySummary({ days }: { days: readonly ExperimentDay[] }) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  return <nav className="ln-day-summary" aria-label={zh ? "日程" : "Schedule"} data-i18n-ignore>
    <p className="ln-day-summary-title">{zh ? `日程 · ${days.length} 天` : `Schedule · ${days.length} days`}</p>
    <ol className="ln-day-summary-days">
      {dayRuns(days).map(({ first: day, last }) => {
        const [name, date] = dayRunLabel(day, last, zh).split(" · ");
        const wait = day.wait ? dayWaitLabel(day.wait, zh) : "";
        return <li key={day.index} className="ln-day-summary-day">
          <a href={`#execution-day-${day.index}`} className="ln-day-summary-tile focus-ring" data-status={day.status}>
            <span className="ln-day-summary-head"><strong>{name}</strong><span>{date}</span>{wait ? <span className="ln-day-summary-wait">{day.wait?.overnight ? (zh ? "过夜后" : "overnight") : zh ? `${wait} 后` : `after ${wait}`}</span> : null}</span>
            <span className="ln-day-summary-content">{dayContent(day, zh) || (zh ? "未安排" : "Nothing planned")}</span>
            {day.status !== "unplanned" ? <span className="ln-day-summary-status"><span className="ln-day-summary-dot" aria-hidden />{dayStatusLabel(day.status, zh)}</span> : null}
          </a>
        </li>;
      })}
    </ol>
  </nav>;
}
