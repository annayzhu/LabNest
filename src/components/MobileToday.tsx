import Link from "next/link";
import { ArrowRight, ArrowUpRight, Calculator, Camera, FlaskConical, TabletSmartphone, Wrench } from "lucide-react";
import { MobileBenchStatus } from "@/components/MobileBenchStatus";
import { MobileWeekCalendar } from "@/components/MobileWeekCalendar";
import type { AppLocale } from "@/lib/i18n";
import { calendarDateKey, type OverviewCalendarActivity } from "@/lib/overview-calendar";

type Experiment = { id: string; title: string; runCode: string; status: string; date: Date };
/** One of today's 日程段 (Q270), linked to its first open step. */
type TodayBlock = { id: string; href: string; title: string; runCode: string; experimentTitle: string; clock: string | null; done: boolean; running: boolean };

export function MobileToday({ experiments, blocks = [], today, monthKey, initialSelectedDateKey, activities, locale }: {
  experiments: Experiment[];
  blocks?: TodayBlock[];
  today: Date;
  monthKey: string;
  initialSelectedDateKey: string;
  activities: OverviewCalendarActivity[];
  locale: AppLocale;
}) {
  const zh = locale === "zh";
  const actions = [
    { href: "/protocol-run", label: zh ? "现场模式" : "Run mode", hint: zh ? "平板 · 手机 · 手表" : "Tablet, phone, watch", icon: TabletSmartphone },
    // Same as ＋ in the bar: the note goes with the experiment in progress.
    { href: "/entries/new?mode=capture&experiment=active", label: zh ? "快速记录" : "Quick capture", hint: zh ? "照片、观察或测量" : "Photo, note, measurement", icon: Camera },
    { href: "/tools/calculator", label: zh ? "计算器" : "Calculator", hint: zh ? "配液与单位换算" : "Mixes and conversions", icon: Calculator },
    { href: "/tools", label: zh ? "工具" : "Tools", hint: zh ? "分析与作图" : "Analysis and plots", icon: Wrench },
  ];
  const ordered = [...experiments].sort((a, b) =>
    Number(b.status === "running") - Number(a.status === "running") || a.date.getTime() - b.date.getTime());
  // Running experiments, whether listed whole or by today's blocks; planned work still to start today.
  const running = new Set([...experiments.filter((experiment) => experiment.status === "running").map((experiment) => experiment.runCode), ...blocks.filter((block) => block.running).map((block) => block.runCode)]).size;
  const planned = experiments.filter((experiment) => experiment.status !== "running").length + blocks.filter((block) => !block.running && !block.done).length;
  const count = ordered.length + blocks.length;
  const dateLabel = today.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" });

  return <section className="bench-mobile space-y-6 lg:hidden">
    <header className="flex items-end justify-between gap-4 pt-1">
      <div className="min-w-0">
        <p className="text-xs font-medium text-moss" data-i18n-ignore>{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink">{zh ? "今日实验台" : "Today at the bench"}</h1>
      </div>
      <dl className="flex shrink-0 divide-x divide-hairline text-right">
        <div className="pr-3">
          <dt className="text-xs text-muted">{zh ? "进行中" : "Running"}</dt>
          <dd className={`font-mono text-xl font-medium leading-7 ${running ? "text-moss" : "text-ink"}`} data-i18n-ignore>{running}</dd>
        </div>
        <div className="pl-3">
          <dt className="text-xs text-muted">{zh ? "待开始" : "Planned"}</dt>
          <dd className="font-mono text-xl font-medium leading-7 text-ink" data-i18n-ignore>{planned}</dd>
        </div>
      </dl>
    </header>

    <nav aria-label={zh ? "实验台快捷入口" : "Bench shortcuts"} className="grid grid-cols-2 gap-3">
      {actions.map(({ href, label, hint, icon: Icon }, index) => {
        const key = index === 0;
        return <Link key={href} href={href}
          className={`focus-ring relative flex min-h-[6.5rem] flex-col justify-between overflow-hidden rounded-[var(--ln-radius-panel)] border p-3.5 transition-colors ${key ? "ln-key-action" : "border-hairline bg-surface text-ink hover:border-border-strong active:bg-warm"}`}>
          <span className="flex items-start justify-between">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${key ? "bg-warm/15 text-warm" : "bg-action-surface text-moss"}`}>
              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <ArrowUpRight className={`h-4 w-4 ${key ? "text-warm/70" : "text-muted"}`} aria-hidden />
          </span>
          <span className="mt-3 block">
            <span className="block text-base font-semibold leading-5">{label}</span>
            <span className={`mt-1 block truncate text-xs ${key ? "text-warm/75" : "text-muted"}`}>{hint}</span>
          </span>
        </Link>;
      })}
    </nav>

    <section aria-labelledby="mobile-today-title">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="mobile-today-title" className="text-base font-semibold text-ink">{zh ? "今日实验" : "Today’s experiments"}</h2>
        <span className="font-mono text-xs text-muted" data-i18n-ignore>{zh ? `${count} 项` : `${count} ${count === 1 ? "item" : "items"}`}</span>
      </div>
      <div className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
        {count ? <ul className="divide-y divide-hairline">
          {blocks.map((block) => <li key={`block-${block.id}`}>
            <Link href={block.href} className="focus-ring flex min-h-[4.5rem] items-center gap-3 px-4 py-3 transition-colors active:bg-warm">
              <span className={`flex h-9 min-w-12 shrink-0 items-center justify-center rounded-full px-2 font-mono text-xs font-medium ${block.running && !block.done ? "bg-action text-warm" : "bg-action-surface text-moss"}`} data-i18n-ignore>{block.clock ?? (zh ? "全天" : "All day")}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold leading-5 text-ink">{block.title}</span>
                <span className="mt-1 block truncate text-xs text-muted" data-i18n-ignore>{block.runCode} · {block.experimentTitle}</span>
              </span>
              <span className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${block.done ? "text-muted" : "border border-action-border text-moss"}`}>
                {block.done ? (zh ? "已完成" : "Done") : (zh ? "去做" : "Open")}
                {block.done ? null : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
              </span>
            </Link>
          </li>)}
          {ordered.map((experiment) => {
            const isRunning = experiment.status === "running";
            return <li key={experiment.id}>
              <Link href={`/experiments/${experiment.id}/run`} className="focus-ring flex min-h-[4.5rem] items-center gap-3 px-4 py-3 transition-colors active:bg-warm">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isRunning ? "bg-action text-warm" : "bg-action-surface text-moss"}`}>
                  <FlaskConical className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm font-semibold leading-5 text-ink">{experiment.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <span className="record-identifier truncate" data-i18n-ignore>{experiment.runCode}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0" data-i18n-ignore>{experiment.date.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" })}</span>
                    {isRunning ? <span className="shrink-0 text-moss">· {zh ? "进行中" : "Running"}</span> : null}
                  </span>
                </span>
                <span className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${isRunning ? "bg-action text-warm" : "border border-action-border text-moss"}`}>
                  {isRunning ? (zh ? "继续" : "Continue") : (zh ? "开始" : "Start")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </li>;
          })}
        </ul> : <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone text-muted"><FlaskConical className="h-4 w-4" aria-hidden /></span>
          <p className="text-sm leading-6 text-muted">{zh ? "今天没有待做或正在进行的实验。" : "No planned or running experiments for today."}</p>
        </div>}
      </div>
    </section>

    <section aria-labelledby="mobile-calendar-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="mobile-calendar-title" className="text-base font-semibold text-ink">{zh ? "日程" : "Schedule"}</h2>
        <Link href={`/?month=${monthKey}&view=calendar`} className="focus-ring -mr-2 flex min-h-11 items-center px-2 text-sm font-medium text-moss">{zh ? "日历" : "Calendar"}</Link>
      </div>
      <MobileWeekCalendar
        key={monthKey}
        monthKey={monthKey}
        todayKey={calendarDateKey(today)}
        initialSelectedDateKey={initialSelectedDateKey}
        activities={activities}
      />
    </section>

    <MobileBenchStatus />
  </section>;
}
